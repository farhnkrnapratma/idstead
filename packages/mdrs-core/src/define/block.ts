import { type Assignment } from './ast';
import { type DefineErrorInfo } from './errors';
import { type ApiRegistry, evaluateExpr } from './evaluate';
import { isValidIdentifierName } from './identifiers';
import { tokenize } from './lexer';
import { Parser } from './parser';
import { type DefineValue } from './values';

export async function evaluateDefineBlock(
    raw: string | null,
    apiRegistry: ApiRegistry
): Promise<{ scope: Map<string, DefineValue>; errors: DefineErrorInfo[] }> {
    const scope = new Map<string, DefineValue>();
    const errors: DefineErrorInfo[] = [];
    if (!raw) return { scope, errors };

    let assignments: Assignment[];
    try {
        assignments = new Parser(tokenize(raw)).parseDefineBlock();
    } catch (err) {
        errors.push({ message: err instanceof Error ? err.message : String(err) });
        return { scope, errors };
    }

    const seenKeys = new Set<string>();
    for (const assignment of assignments) {
        const { key, value } = assignment;
        if (!isValidIdentifierName(key)) {
            errors.push({
                message: `'${key}' is not a valid variable name (check reserved words / naming rules)`,
                key
            });
            continue;
        }
        if (seenKeys.has(key)) {
            errors.push({ message: `'${key}' is already defined`, key });
            continue;
        }
        try {
            const result = await evaluateExpr(value, { scope, allowThis: true, apiRegistry });
            scope.set(key, result);
            seenKeys.add(key);
        } catch (err) {
            errors.push({ message: err instanceof Error ? err.message : String(err), key });
        }
    }

    return { scope, errors };
}

const LEADING_WS_RE = /^[\s\uFEFF]*/;

export const DEFINE_BLOCK_RE = /^:::define[^\n]*\r?\n(?:([\s\S]*?)\r?\n)?:::[ \t]*(?=\r?\n|$)/i;

const STRAY_DEFINE_OPEN_RE = /^[ \t]*:::define\b/i;

const DIRECTIVE_CLOSE_RE = /^[ \t]*:::[ \t]*$/;

function hasStrayDefineBlock(body: string): boolean {
    const lines = body.split('\n').map(line => line.replace(/\r$/, ''));
    const open = lines.findIndex(line => STRAY_DEFINE_OPEN_RE.test(line));
    if (open === -1) return false;
    return lines.some((line, index) => index > open && DIRECTIVE_CLOSE_RE.test(line));
}

function maskFencedCodeBlocks(markdown: string): string {
    const lines = markdown.split(/(\r?\n)/);
    let fence: { char: string; length: number } | null = null;

    return lines
        .map(line => {
            if (/^\r?\n$/.test(line)) return line;

            const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
            if (!fence && opening) {
                fence = { char: opening[1][0], length: opening[1].length };
                return line.replace(/[^\r]/g, ' ');
            }

            if (fence) {
                const closing = new RegExp(`^ {0,3}${fence.char}{${fence.length},}[ \\t]*$`);
                const masked = line.replace(/[^\r]/g, ' ');
                if (closing.test(line)) fence = null;
                return masked;
            }

            return line;
        })
        .join('');
}

export function hasDefineEntries(raw: string | null): boolean {
    return raw !== null && raw.replace(/\/\/[^\n]*/g, '').trim() !== '';
}

export function extractDefineBlock(markdown: string): {
    raw: string | null;
    body: string;
    errors: DefineErrorInfo[];
} {
    const errors: DefineErrorInfo[] = [];
    const trimmed = markdown.replace(LEADING_WS_RE, '');
    const match = trimmed.match(DEFINE_BLOCK_RE);
    let raw: string | null = null;
    let body = markdown;

    if (match) {
        raw = match[1] ?? '';
        body = trimmed.slice(match[0].length).replace(/^\r?\n/, '');
        if (!hasDefineEntries(raw)) {
            errors.push({ message: 'A :::define block needs at least one entry.' });
        }
    }

    if (hasStrayDefineBlock(maskFencedCodeBlocks(body))) {
        errors.push({
            message:
                'Only one :::define block is allowed, and it must be the first thing in the document.'
        });
    }

    return { raw, body, errors };
}
