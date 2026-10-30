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

const BLOCK_IF_RE = /^ {0,3}:::if[ \t]+(\S.*?)[ \t]*$/i;

const BLOCK_ELIF_RE = /^ {0,3}:::elif[ \t]+(\S.*?)[ \t]*$/i;

const BLOCK_ELSE_RE = /^ {0,3}:::else[ \t]*$/i;

const BLOCK_ENDIF_RE = /^ {0,3}:::endif[ \t]*$/i;

const BLOCK_DIRECTIVE_RE = /^ {0,3}:::(?:if|elif|else|endif)\b/im;

const INLINE_IF_RE = /^\s*if\s+(\S[\s\S]*?)\s*$/;

const INLINE_ELIF_RE = /^\s*elif\s+(\S[\s\S]*?)\s*$/;

const INLINE_ELSE_RE = /^\s*else\s*$/;

const INLINE_ENDIF_RE = /^\s*endif\s*$/;

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

async function chooseBranch<T>(
    group: Group<T>,
    ctx: Context
): Promise<{ chosen: Branch<T>[]; error: string | null }> {
    if (ctx.mode === 'validate') {
        for (const branch of group.branches) {
            if (branch.condition === null) continue;
            try {
                await evaluateCondition(branch.condition, ctx);
            } catch (err) {
                ctx.errors.push({ message: err instanceof Error ? err.message : String(err) });
            }
        }
        return { chosen: group.branches, error: null };
    }
    for (const branch of group.branches) {
        if (branch.condition === null) return { chosen: [branch], error: null };
        try {
            if (await evaluateCondition(branch.condition, ctx)) {
                return { chosen: [branch], error: null };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            ctx.errors.push({ message });
            return { chosen: [], error: message };
        }
    }
    return { chosen: [], error: null };
}

function parseBlocks(lines: string[], ctx: Context): BlockNode[] {
    const root: BlockNode[] = [];
    const stack: { group: Group<BlockNode>; start: number }[] = [];
    const current = () => {
        const top = stack.at(-1);
        return top ? top.group.branches[top.group.branches.length - 1].body : root;
    };
    lines.forEach((line, index) => {
        const opening = line.match(BLOCK_IF_RE);
        if (opening && stack.length < MAX_BLOCK_DEPTH) {
            const group: Group<BlockNode> = {
                kind: 'group',
                branches: [{ condition: opening[1], body: [] }],
                hasElse: false
            };
            stack.push({ group, start: index });
            return;
        }
        const top = stack.at(-1);
        const elif = line.match(BLOCK_ELIF_RE);
        if (elif && top && !top.group.hasElse) {
            top.group.branches.push({ condition: elif[1], body: [] });
            return;
        }
        if (BLOCK_ELSE_RE.test(line) && top && !top.group.hasElse) {
            top.group.branches.push({ condition: null, body: [] });
            top.group.hasElse = true;
            return;
        }
        if (BLOCK_ENDIF_RE.test(line) && top) {
            stack.pop();
            current().push(top.group);
            return;
        }
        if (BLOCK_ELIF_RE.test(line) || BLOCK_ELSE_RE.test(line) || BLOCK_ENDIF_RE.test(line)) {
            ctx.errors.push({ message: `'${line.trim()}' has no matching :::if` });
        }
        current().push({ kind: 'line', text: line });
    });
    if (stack.length) {
        ctx.errors.push({
            message: `':::if ${stack[0].group.branches[0].condition}' is never closed with :::endif`
        });
        root.push(...lines.slice(stack[0].start).map(text => ({ kind: 'line' as const, text })));
    }
    return root;
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

function parseInline(text: string, ctx: Context): InlineNode[] {
    const root: InlineNode[] = [];
    const stack: Group<InlineNode>[] = [];
    const current = () => {
        const top = stack.at(-1);
        return top ? top.branches[top.branches.length - 1].body : root;
    };
    const stray = (message: string) => {
        ctx.errors.push({ message });
        current().push({ kind: 'text', text: renderDefineErrorMarker(message) });
    };
    let cursor = 0;
    for (const token of scanInterpolationTokens(text)) {
        const inner = token.exprSource;
        const opening = inner.match(INLINE_IF_RE);
        const elif = inner.match(INLINE_ELIF_RE);
        const isElse = INLINE_ELSE_RE.test(inner);
        const isEndif = INLINE_ENDIF_RE.test(inner);
        if (!opening && !elif && !isElse && !isEndif) continue;
        if (token.start > cursor)
            current().push({ kind: 'text', text: text.slice(cursor, token.start) });
        cursor = token.end;
        const top = stack.at(-1);
        if (opening) {
            if (stack.length >= MAX_INLINE_DEPTH) {
                stray(`\${if} is nested more than ${MAX_INLINE_DEPTH} levels deep`);
                continue;
            }
            stack.push({
                kind: 'group',
                branches: [{ condition: opening[1], body: [] }],
                hasElse: false
            });
        } else if (elif) {
            if (!top || top.hasElse) stray('${elif} has no matching ${if}');
            else top.branches.push({ condition: elif[1], body: [] });
        } else if (isElse) {
            if (!top || top.hasElse) stray('${else} has no matching ${if}');
            else {
                top.branches.push({ condition: null, body: [] });
                top.hasElse = true;
            }
        } else if (!top) {
            stray('${endif} has no matching ${if}');
        } else {
            stack.pop();
            current().push(top);
        }
    }
    if (cursor < text.length) current().push({ kind: 'text', text: text.slice(cursor) });
    while (stack.length) {
        const unclosed = stack.pop() as Group<InlineNode>;
        const message = `'\${if ${unclosed.branches[0].condition}}' is never closed with \${endif}`;
        ctx.errors.push({ message });
        const body = unclosed.branches.flatMap(branch => branch.body);
        const target = stack.at(-1);
        const into = target ? target.branches[target.branches.length - 1].body : root;
        into.push({ kind: 'text', text: renderDefineErrorMarker(message) }, ...body);
    }
    return root;
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
