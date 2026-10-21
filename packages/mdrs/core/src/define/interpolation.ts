import {
    placeholderKey,
    protectFencedCode,
    protectInlineCode,
    restoreAllPlaceholders
} from '../placeholders';
import { DefineError, type DefineErrorInfo } from './errors';
import { type ApiRegistry, evaluateExpr } from './evaluate';
import { tokenize } from './lexer';
import { Parser } from './parser';
import { type DefineValue, toDisplayString } from './values';

export interface InterpolationToken {
    start: number;
    end: number;
    kind: 'conditional' | 'plain';
    bracketContent?: string;
    exprSource: string;
}

const MAX_CONDITIONAL_TEXT_LENGTH = 5000;

const MAX_EXPRESSION_LENGTH = 2000;

const MAX_SCAN_STEPS = 2_000_000;

interface ScanBudget {
    left: number;
}

function findMatchingBracket(
    text: string,
    openPos: number,
    openChar: string,
    closeChar: string,
    maxLength: number,
    budget: ScanBudget
): number {
    if (budget.left <= 0) return -1;
    const n = Math.min(text.length, openPos + maxLength, openPos + budget.left);
    let depth = 0;
    let j = openPos;
    const spend = () => {
        budget.left -= j - openPos + 1;
    };
    while (j < n) {
        const c = text[j];
        if (c === '"') {
            j++;
            while (j < n && text[j] !== '"') {
                if (text[j] === '\\') j += 2;
                else j++;
            }
            j++;
            continue;
        }
        if (c === openChar) depth++;
        else if (c === closeChar) {
            depth--;
            if (depth === 0) {
                spend();
                return j;
            }
        }
        j++;
    }
    spend();
    return -1;
}

export function scanInterpolationTokens(text: string): InterpolationToken[] {
    const tokens: InterpolationToken[] = [];
    const budget: ScanBudget = { left: MAX_SCAN_STEPS };
    let i = 0;
    const n = text.length;

    while (i < n) {
        if (text[i] === '\\') {
            i += 2;
            continue;
        }
        if (text[i] === '[') {
            const closeBracket = findMatchingBracket(
                text,
                i,
                '[',
                ']',
                MAX_CONDITIONAL_TEXT_LENGTH,
                budget
            );
            if (
                closeBracket !== -1
                && text[closeBracket + 1] === '.'
                && text[closeBracket + 2] === '$'
                && text[closeBracket + 3] === '{'
            ) {
                const openBrace = closeBracket + 3;
                const closeBrace = findMatchingBracket(
                    text,
                    openBrace,
                    '{',
                    '}',
                    MAX_EXPRESSION_LENGTH,
                    budget
                );
                if (closeBrace !== -1) {
                    tokens.push({
                        start: i,
                        end: closeBrace + 1,
                        kind: 'conditional',
                        bracketContent: text.slice(i + 1, closeBracket),
                        exprSource: text.slice(openBrace + 1, closeBrace)
                    });
                    i = closeBrace + 1;
                    continue;
                }
            }
            i++;
            continue;
        }
        if (text[i] === '$' && text[i + 1] === '{') {
            const closeBrace = findMatchingBracket(
                text,
                i + 1,
                '{',
                '}',
                MAX_EXPRESSION_LENGTH,
                budget
            );
            if (closeBrace !== -1) {
                tokens.push({
                    start: i,
                    end: closeBrace + 1,
                    kind: 'plain',
                    exprSource: text.slice(i + 2, closeBrace)
                });
                i = closeBrace + 1;
                continue;
            }
        }
        i++;
    }

    return tokens;
}

function renderDefineErrorMarker(message: string): string {
    const escaped = message
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<span class="mdrs-define-error" title="${escaped}">[define error]</span>`;
}

const MAX_INTERPOLATION_DEPTH = 8;

async function interpolateText(
    text: string,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry,
    depth: number
): Promise<{ output: string; errors: DefineErrorInfo[] }> {
    const tokens = scanInterpolationTokens(text);
    const errors: DefineErrorInfo[] = [];
    let output = text;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const result = await evaluateInterpolationToken(token, scope, apiRegistry, depth);
        errors.unshift(...result.errors);
        output = output.slice(0, token.start) + result.replacement + output.slice(token.end);
    }
    return { output, errors };
}

async function evaluateInterpolationToken(
    token: InterpolationToken,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry,
    depth = 0
): Promise<{ replacement: string; errors: DefineErrorInfo[] }> {
    try {
        const expr = new Parser(tokenize(token.exprSource)).parseExpression();
        const value = await evaluateExpr(expr, { scope, allowThis: false, apiRegistry });
        if (token.kind === 'conditional') {
            if (value.type !== 'boolean') {
                throw new DefineError('Expected a boolean expression inside [...].${...}');
            }
            if (!value.value) return { replacement: '', errors: [] };
            const content = token.bracketContent ?? '';
            if (depth >= MAX_INTERPOLATION_DEPTH) return { replacement: content, errors: [] };
            const nested = await interpolateText(content, scope, apiRegistry, depth + 1);
            return { replacement: nested.output, errors: nested.errors };
        }
        return { replacement: toDisplayString(value), errors: [] };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { replacement: renderDefineErrorMarker(message), errors: [{ message }] };
    }
}

export async function interpolateBody(
    bodyMarkdown: string,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry
): Promise<{ output: string; errors: DefineErrorInfo[] }> {
    if (!bodyMarkdown) return { output: '', errors: [] };

    const codePlaceholders = new Map<string, string>();
    let text = protectFencedCode(bodyMarkdown, 'FENCED_CODE', codePlaceholders);
    text = protectInlineCode(text, 'INLINE_CODE', codePlaceholders);

    const { output, errors } = await interpolateText(text, scope, apiRegistry, 0);
    return { output: restoreAllPlaceholders(output, codePlaceholders), errors };
}

export function protectInterpolationTokens(markdown: string, store: Map<string, string>): string {
    const codePlaceholders = new Map<string, string>();
    let text = protectFencedCode(markdown, 'FENCED_CODE', codePlaceholders);
    text = protectInlineCode(text, 'INLINE_CODE', codePlaceholders);

    const tokens = scanInterpolationTokens(text);
    let result = text;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const key = placeholderKey('INTERPOLATION', store.size);
        store.set(key, text.slice(token.start, token.end));
        result = result.slice(0, token.start) + key + result.slice(token.end);
    }

    return restoreAllPlaceholders(result, codePlaceholders);
}

export async function resolveProtectedInterpolationTokens(
    text: string,
    store: Map<string, string>,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry
): Promise<{ output: string; errors: DefineErrorInfo[] }> {
    let result = text;
    const errors: DefineErrorInfo[] = [];

    for (const [key, originalSpan] of store.entries()) {
        const tokens = scanInterpolationTokens(originalSpan);
        let replacement = originalSpan;
        if (tokens.length === 1 && tokens[0].start === 0) {
            const result = await evaluateInterpolationToken(tokens[0], scope, apiRegistry);
            replacement = result.replacement;
            errors.push(...result.errors);
        }
        result = result.replaceAll(key, () => replacement);
    }

    return { output: result, errors };
}
