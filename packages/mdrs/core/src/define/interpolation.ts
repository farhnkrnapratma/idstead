// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import {
    placeholderKey,
    protectFencedCode,
    protectInlineCode,
    restoreAllPlaceholders
} from '../placeholders';
import { type DefineErrorInfo } from './errors';
import { type ApiRegistry, evaluateExpr } from './evaluate';
import { findExpressionEnd, tokenize } from './lexer';
import { Parser } from './parser';
import { type DefineValue, toDisplayString } from './values';

export interface InterpolationToken {
    start: number;
    end: number;
    exprSource: string;
}

const MAX_EXPRESSION_LENGTH = 2000;

const MAX_SCAN_STEPS = 2_000_000;

export function scanInterpolationTokens(text: string): InterpolationToken[] {
    const tokens: InterpolationToken[] = [];
    let budget = MAX_SCAN_STEPS;
    let i = 0;
    const n = text.length;

    while (i < n && budget > 0) {
        if (text[i] === '\\') {
            i += 2;
            continue;
        }
        if (text[i] === '$' && text[i + 1] === '{') {
            const closeBrace = findExpressionEnd(text, i + 1, i + 1 + MAX_EXPRESSION_LENGTH);
            budget -= closeBrace === -1 ? MAX_EXPRESSION_LENGTH : closeBrace - i;
            if (closeBrace !== -1) {
                tokens.push({
                    start: i,
                    end: closeBrace + 1,
                    exprSource: text.slice(i + 2, closeBrace)
                });
                i = closeBrace + 1;
                continue;
            }
        }
        i++;
        budget--;
    }

    return tokens;
}

export function renderDefineErrorMarker(message: string): string {
    const escaped = message
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<span class="mdrs-define-error" title="${escaped}">[define error]</span>`;
}

async function interpolateText(
    text: string,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry
): Promise<{ output: string; errors: DefineErrorInfo[] }> {
    const tokens = scanInterpolationTokens(text);
    const errors: DefineErrorInfo[] = [];
    let output = text;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const result = await evaluateInterpolationToken(token, scope, apiRegistry);
        errors.unshift(...result.errors);
        output = output.slice(0, token.start) + result.replacement + output.slice(token.end);
    }
    return { output, errors };
}

async function evaluateInterpolationToken(
    token: InterpolationToken,
    scope: Map<string, DefineValue>,
    apiRegistry: ApiRegistry
): Promise<{ replacement: string; errors: DefineErrorInfo[] }> {
    try {
        const expr = new Parser(tokenize(token.exprSource)).parseCompleteExpression();
        const value = await evaluateExpr(expr, { scope, allowThis: false, apiRegistry });
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

    const { output, errors } = await interpolateText(text, scope, apiRegistry);
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
