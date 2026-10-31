// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import katex from 'katex';
import {
    placeholderKey,
    protectFencedCode,
    protectInlineCode,
    replaceLineBlocks,
    restoreAllPlaceholders
} from '../placeholders';
import { escapeAttr } from './attrs';
import { QUOTE_MARKER_RE } from './containers';

const MATH_OPEN_RE = /^((?: {0,3}>[ ]?)* {0,3}):::math[ \t]*$/i;

const MATH_CLOSE_RE = /^(?: {0,3}>[ ]?)* {0,3}:::[ \t]*$/;

export function replaceMathBlocks(
    text: string,
    render: (prefix: string, source: string, block: string) => string
): string {
    return replaceLineBlocks(
        text,
        line => line.match(MATH_OPEN_RE),
        line => (MATH_CLOSE_RE.test(line) ? '' : null),
        () => '',
        (match, body, block) => render(match[1], body, block)
    );
}

export const MATH_INLINE_RE =
    /(?<!\\)\$\$(?:[ \t]+((?:(?!\$\$)[^\n])*?[^\s$])[ \t]+|([^\s$](?:(?:(?!\$\$)[^\n])*?[^\s\\])?))\$\$(?!\d)/g;

function decodeMathEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export interface MathSource {
    source: string;
    display: boolean;
}

export function extractMath(markdown: string, sources: Map<string, MathSource>): string {
    if (!markdown) return '';

    const codePlaceholders = new Map<string, string>();
    let text = protectFencedCode(markdown, 'FENCED_CODE', codePlaceholders);
    text = protectInlineCode(text, 'INLINE_CODE', codePlaceholders);

    let mathIndex = 0;
    const readSource = (source: string) =>
        decodeMathEntities(restoreAllPlaceholders(source, codePlaceholders).trim());

    text = replaceMathBlocks(text, (prefix, source) => {
        const key = placeholderKey('MATH_BLOCK', mathIndex++);
        const quote = (prefix.match(/>/g) ?? []).length;
        const indent = prefix.length - prefix.replace(/ +$/, '').length;
        const body = source
            .split('\n')
            .map(line => {
                let rest = line.replace(/\r$/, '');
                for (let depth = 0; depth < quote; depth++) {
                    rest = rest.replace(QUOTE_MARKER_RE, '');
                }
                let strip = 0;
                while (strip < indent && rest[strip] === ' ') strip++;
                return rest.slice(strip);
            })
            .join('\n');
        sources.set(key, { source: readSource(body), display: true });
        const lead = '> '.repeat(quote).trimEnd();
        return quote ? `${lead}\n${prefix}${key}\n${lead}` : `\n${prefix}${key}\n`;
    });

    text = text.replace(
        MATH_INLINE_RE,
        (_, spaced: string | undefined, tight: string | undefined) => {
            const source = spaced ?? tight ?? '';
            const key = placeholderKey('MATH_INLINE', mathIndex++);
            sources.set(key, { source: readSource(source), display: false });
            return key;
        }
    );

    return restoreAllPlaceholders(text, codePlaceholders);
}

function renderMathSource({ source, display }: MathSource): string {
    try {
        const html = katex.renderToString(source, { displayMode: display, throwOnError: false });
        return display ? `<div class="mdrs-math mdrs-math--block">${html}</div>` : html;
    } catch {
        return display ?
                `<div class="mdrs-math-error">${escapeAttr(source)}</div>`
            :   `$$${escapeAttr(source)}$$`;
    }
}

export async function renderMathSources(
    sources: Map<string, MathSource>,
    resolveSource: (source: string) => Promise<string>
): Promise<Map<string, string>> {
    const rendered = new Map<string, string>();
    for (const [key, entry] of sources) {
        rendered.set(
            key,
            renderMathSource({ ...entry, source: await resolveSource(entry.source) })
        );
    }
    return rendered;
}

export function replaceKatexWithSource(html: string): string {
    const opening = '<span class="katex">';
    const spanTag = /<(\/?)span\b[^>]*>/g;
    let output = '';
    let position = 0;
    for (;;) {
        const start = html.indexOf(opening, position);
        if (start === -1) return output + html.slice(position);
        output += html.slice(position, start);
        let depth = 0;
        let end = -1;
        spanTag.lastIndex = start;
        for (let tag = spanTag.exec(html); tag; tag = spanTag.exec(html)) {
            depth += tag[1] ? -1 : 1;
            if (depth === 0) {
                end = spanTag.lastIndex;
                break;
            }
        }
        if (end === -1) return output + html.slice(start);
        const source = html.slice(start, end).match(/<annotation[^>]*>([\s\S]*?)<\/annotation>/);
        output += source?.[1] ?? '';
        position = end;
    }
}
