import { protectFencedCode, protectInlineCode, restoreAllPlaceholders } from '../placeholders';
import { DefineError, type DefineErrorInfo } from './errors';
import { type ApiRegistry, evaluateExpr } from './evaluate';
import { renderDefineErrorMarker, scanInterpolationTokens } from './interpolation';
import { tokenize } from './lexer';
import { Parser } from './parser';
import { type DefineValue } from './values';

export type ConditionalMode = 'render' | 'validate';

export interface ConditionalOptions {
    inline: boolean;
    mode?: ConditionalMode;
}

interface Context {
    scope: Map<string, DefineValue>;
    apiRegistry: ApiRegistry;
    mode: ConditionalMode;
    errors: DefineErrorInfo[];
}

interface Branch<T> {
    condition: string | null;
    body: T[];
}

interface Group<T> {
    kind: 'group';
    branches: Branch<T>[];
    hasElse: boolean;
}

type BlockNode = { kind: 'line'; text: string } | Group<BlockNode>;

type InlineNode = { kind: 'text'; text: string } | Group<InlineNode>;

const MAX_BLOCK_DEPTH = 16;

const MAX_INLINE_DEPTH = 8;

type Directive =
    { kind: 'if' | 'elif'; condition: string } | { kind: 'else' | 'endif'; condition?: never };

const BLOCK_DIRECTIVE_LINE_RE = /^ {0,3}:::(if|elif|else|endif)(?:[ \t]+(\S.*?))?[ \t]*$/i;

const BLOCK_DIRECTIVE_RE = /^ {0,3}:::(?:if|elif|else|endif)\b/im;

const INLINE_DIRECTIVE_RE = /^\s*(if|elif|else|endif)(?:\s+(\S[\s\S]*?))?\s*$/;

function directive(match: RegExpMatchArray | null): Directive | null {
    if (!match) return null;
    const kind = match[1].toLowerCase() as Directive['kind'];
    const condition = match[2];
    if (kind === 'if' || kind === 'elif') return condition ? { kind, condition } : null;
    return condition ? null : { kind };
}

class BranchStack<T> {
    readonly root: T[] = [];
    readonly open: { group: Group<T>; start: number }[] = [];
    readonly maxDepth: number;

    constructor(maxDepth: number) {
        this.maxDepth = maxDepth;
    }

    body(): T[] {
        const top = this.open.at(-1)?.group;
        return top ? top.branches[top.branches.length - 1].body : this.root;
    }

    apply(next: Directive, start: number): boolean {
        const top = this.open.at(-1)?.group;
        if (next.kind === 'if') {
            if (this.open.length >= this.maxDepth) return false;
            const group: Group<T> = {
                kind: 'group',
                branches: [{ condition: next.condition, body: [] }],
                hasElse: false
            };
            this.open.push({ group, start });
            return true;
        }
        if (!top) return false;
        if (next.kind === 'endif') {
            this.open.pop();
            this.body().push(top as T);
            return true;
        }
        if (top.hasElse) return false;
        top.branches.push({ condition: next.condition ?? null, body: [] });
        top.hasElse = next.kind === 'else';
        return true;
    }
}

const CONDITION_LINE_RE = /^ {0,3}:::(?:if|elif)[ \t]+(\S.*?)[ \t]*$/gim;

export function conditionSources(markdown: string): string[] {
    return [...markdown.matchAll(CONDITION_LINE_RE)].map(match => match[1]);
}

async function evaluateCondition(source: string, ctx: Context): Promise<boolean> {
    const expr = new Parser(tokenize(source)).parseCompleteExpression();
    const value = await evaluateExpr(expr, {
        scope: ctx.scope,
        allowThis: false,
        apiRegistry: ctx.apiRegistry
    });
    if (value.type !== 'boolean') {
        throw new DefineError(`Expected a boolean condition, got a ${value.type}: ${source}`);
    }
    return value.value as boolean;
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function validateBranches<T>(group: Group<T>, ctx: Context): Promise<Branch<T>[]> {
    for (const { condition } of group.branches) {
        if (condition === null) continue;
        await evaluateCondition(condition, ctx).catch(err => {
            ctx.errors.push({ message: errorMessage(err) });
        });
    }
    return group.branches;
}

async function pickBranch<T>(
    group: Group<T>,
    ctx: Context
): Promise<{ chosen: Branch<T>[]; error: string | null }> {
    try {
        for (const branch of group.branches) {
            if (branch.condition === null || (await evaluateCondition(branch.condition, ctx)))
                return { chosen: [branch], error: null };
        }
        return { chosen: [], error: null };
    } catch (err) {
        const message = errorMessage(err);
        ctx.errors.push({ message });
        return { chosen: [], error: message };
    }
}

async function chooseBranch<T>(
    group: Group<T>,
    ctx: Context
): Promise<{ chosen: Branch<T>[]; error: string | null }> {
    if (ctx.mode === 'validate') return { chosen: await validateBranches(group, ctx), error: null };
    return pickBranch(group, ctx);
}

function parseBlocks(lines: string[], ctx: Context): BlockNode[] {
    const stack = new BranchStack<BlockNode>(MAX_BLOCK_DEPTH);
    lines.forEach((line, index) => {
        const next = directive(line.match(BLOCK_DIRECTIVE_LINE_RE));
        if (next && stack.apply(next, index)) return;
        if (next && next.kind !== 'if')
            ctx.errors.push({ message: `'${line.trim()}' has no matching :::if` });
        stack.body().push({ kind: 'line', text: line });
    });
    const unclosed = stack.open[0];
    if (unclosed) {
        ctx.errors.push({
            message: `':::if ${unclosed.group.branches[0].condition}' is never closed with :::endif`
        });
        stack.root.push(
            ...lines.slice(unclosed.start).map(text => ({ kind: 'line' as const, text }))
        );
    }
    return stack.root;
}

async function renderBlocks(nodes: BlockNode[], ctx: Context): Promise<string[]> {
    const output: string[] = [];
    for (const node of nodes) {
        if (node.kind === 'line') {
            output.push(node.text);
            continue;
        }
        const { chosen, error } = await chooseBranch(node, ctx);
        if (error !== null) output.push(renderDefineErrorMarker(error));
        for (const branch of chosen) output.push(...(await renderBlocks(branch.body, ctx)));
    }
    return output;
}

function strayMessage(next: Directive): string {
    return next.kind === 'if' ?
            `\${if} is nested more than ${MAX_INLINE_DEPTH} levels deep`
        :   `\${${next.kind}} has no matching \${if}`;
}

function closeInline(stack: BranchStack<InlineNode>, ctx: Context): void {
    while (stack.open.length) {
        const { group } = stack.open.pop() as { group: Group<InlineNode> };
        const message = `'\${if ${group.branches[0].condition}}' is never closed with \${endif}`;
        ctx.errors.push({ message });
        stack
            .body()
            .push(
                { kind: 'text', text: renderDefineErrorMarker(message) },
                ...group.branches.flatMap(branch => branch.body)
            );
    }
}

function parseInline(text: string, ctx: Context): InlineNode[] {
    const stack = new BranchStack<InlineNode>(MAX_INLINE_DEPTH);
    let cursor = 0;
    for (const token of scanInterpolationTokens(text)) {
        const next = directive(token.exprSource.match(INLINE_DIRECTIVE_RE));
        if (!next) continue;
        if (token.start > cursor)
            stack.body().push({ kind: 'text', text: text.slice(cursor, token.start) });
        cursor = token.end;
        if (stack.apply(next, token.start)) continue;
        const message = strayMessage(next);
        ctx.errors.push({ message });
        stack.body().push({ kind: 'text', text: renderDefineErrorMarker(message) });
    }
    if (cursor < text.length) stack.body().push({ kind: 'text', text: text.slice(cursor) });
    closeInline(stack, ctx);
    return stack.root;
}

async function renderInline(nodes: InlineNode[], ctx: Context): Promise<string> {
    let output = '';
    for (const node of nodes) {
        if (node.kind === 'text') {
            output += node.text;
            continue;
        }
        const { chosen, error } = await chooseBranch(node, ctx);
        if (error !== null) output += renderDefineErrorMarker(error);
        for (const branch of chosen) output += await renderInline(branch.body, ctx);
    }
    return output;
}

export async function resolveConditionals(
    markdown: string,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry,
    options: ConditionalOptions
): Promise<{ output: string; errors: DefineErrorInfo[] }> {
    const ctx: Context = { scope, apiRegistry, mode: options.mode ?? 'render', errors: [] };
    const code = new Map<string, string>();
    let text = protectFencedCode(markdown, 'CONDITIONAL_FENCE', code);
    text = protectInlineCode(text, 'CONDITIONAL_CODE', code);
    if (BLOCK_DIRECTIVE_RE.test(text)) {
        text = (await renderBlocks(parseBlocks(text.split('\n'), ctx), ctx)).join('\n');
    }
    if (options.inline && text.includes('${')) {
        text = await renderInline(parseInline(text, ctx), ctx);
    }
    return { output: restoreAllPlaceholders(text, code), errors: ctx.errors };
}
