// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import type { HLJSApi, Language, Mode, ModeCallback } from 'highlight.js';
import markdown from 'highlight.js/lib/languages/markdown';

const LINE_START = /^ {0,3}(?:>[ \t]?)*/.source;

function line(body: string): RegExp {
    return new RegExp(`${LINE_START}${body}`);
}

export function mdrsLanguage(hljs: HLJSApi): Language {
    const KEYWORDS = {
        keyword: ['if', 'elif', 'else', 'endif'],
        literal: ['true', 'false', 'null'],
        built_in: ['get'],
        'variable.language': ['this']
    };
    const NUMBER: Mode = { scope: 'number', match: /\b\d+(?:\.\d+)?\b/, relevance: 0 };
    const OPERATOR: Mode = {
        scope: 'operator',
        match: /[=!<>]=|&&|\|\||[+\-*/%<>!?]/,
        relevance: 0
    };
    const SUBST: Mode = {
        scope: 'template-variable',
        begin: /\$\{/,
        end: /\}/,
        keywords: KEYWORDS,
        contains: []
    };
    const DOLLAR_NAME: Mode = { scope: 'template-variable', match: /\$[A-Za-z_]\w*/ };
    const DOUBLE_STRING: Mode = {
        scope: 'string',
        begin: '"',
        end: '"',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST, DOLLAR_NAME]
    };
    const SINGLE_STRING: Mode = {
        scope: 'string',
        begin: "'",
        end: "'",
        contains: [hljs.BACKSLASH_ESCAPE]
    };
    const BRACES: Mode = { begin: /\{/, end: /\}/, keywords: KEYWORDS, contains: [] };
    const EXPRESSION: Mode[] = [DOUBLE_STRING, SINGLE_STRING, NUMBER, BRACES, OPERATOR];
    SUBST.contains = EXPRESSION;
    BRACES.contains = [{ scope: 'attr', match: /[A-Za-z_]\w*(?=[ \t]*:)/ }, ...EXPRESSION];

    const ESCAPE: Mode = { match: /\\[\\$]/, relevance: 0 };
    const MATH_INLINE: Mode = { scope: 'formula', begin: /\$\$/, end: /\$\$/, contains: [SUBST] };
    const INLINE: Mode[] = [ESCAPE, SUBST, MATH_INLINE];

    const DIRECTIVE_CLOSE = line(':{2,}[ \\t]*$');
    const ATTRIBUTES: Mode[] = [
        { scope: 'attr', match: /[A-Za-z][\w-]*(?==)/ },
        { scope: 'string', begin: '"', end: '"', contains: [hljs.BACKSLASH_ESCAPE] }
    ];

    const FRONTMATTER: Mode = {
        begin: /^---[ \t]*\n(?=[A-Za-z_][\w-]*[ \t]*:)/,
        end: /^---[ \t]*$/,
        beginScope: 'meta',
        endScope: 'meta',
        subLanguage: 'yaml',
        'on:begin': (match, response) => {
            if (match.index !== 0) response.ignoreMatch();
        }
    };
    const VERBATIM: Mode = {
        begin: /^ {0,3}(:{3,})verbatim[ \t]*$/,
        end: /^ {0,3}(:{3,})[ \t]*$/,
        beginScope: 'keyword',
        endScope: 'keyword',
        'on:begin': (match, response) => {
            response.data._colons = match[1];
        },
        'on:end': ((match, response) => {
            if (match[1] !== response.data._colons) response.ignoreMatch();
        }) satisfies ModeCallback
    };
    const DEFINE: Mode = {
        begin: line(':::define[ \\t]*$'),
        end: DIRECTIVE_CLOSE,
        beginScope: 'keyword',
        endScope: 'keyword',
        keywords: KEYWORDS,
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            { scope: 'attr', match: /(?<=^[ \t>]*|,[ \t]*)[A-Za-z_]\w*(?=[ \t]*:)/ },
            ...EXPRESSION
        ]
    };
    const MATH_BLOCK: Mode = {
        begin: line(':::math[ \\t]*$'),
        end: DIRECTIVE_CLOSE,
        beginScope: 'keyword',
        endScope: 'keyword',
        subLanguage: 'latex'
    };
    const CONDITION: Mode = {
        begin: line(':::(?:if|elif)\\b'),
        end: /$/,
        beginScope: 'keyword',
        keywords: KEYWORDS,
        contains: EXPRESSION
    };
    const CONDITION_END: Mode = { scope: 'keyword', match: line(':::(?:else|endif)[ \\t]*$') };
    const DIRECTIVE_OPEN: Mode = {
        begin: line(':{2,}[A-Za-z][A-Za-z-]*'),
        end: /$/,
        beginScope: 'keyword',
        contains: ATTRIBUTES
    };
    const CLOSE: Mode = { scope: 'keyword', match: DIRECTIVE_CLOSE };
    const TASK_STATE: Mode = {
        scope: 'symbol',
        match: /(?<=^[ \t>]*(?:[*+-]|\d+[.)])[ \t]+)\[[ xX*/\-!?]\](?=[ \t])/
    };

    const base = markdown(hljs);
    const textScopes = new Set(['section', 'quote', 'strong', 'emphasis']);
    const extended = new Set<Mode[]>();
    const visited = new Set<Mode>();
    const holdsText = (mode: Mode) =>
        textScopes.has(String(mode.className)) ||
        (!mode.className && !mode.returnBegin && Boolean(mode.contains || mode.variants));
    const addInline = (mode: Mode) => {
        if (visited.has(mode)) return;
        visited.add(mode);
        const own = mode.contains as Mode[] | undefined;
        const children = [...(mode.variants ?? []), ...(own ?? [])];
        if (own && !extended.has(own)) {
            extended.add(own);
            own.unshift(...INLINE);
        }
        for (const child of children)
            if (!INLINE.includes(child) && holdsText(child)) addInline(child);
    };
    for (const mode of base.contains as Mode[]) {
        if (textScopes.has(String(mode.className))) addInline(mode);
    }

    return {
        name: 'MDRS',
        aliases: ['mdrs'],
        contains: [
            FRONTMATTER,
            VERBATIM,
            DEFINE,
            MATH_BLOCK,
            CONDITION,
            CONDITION_END,
            DIRECTIVE_OPEN,
            CLOSE,
            TASK_STATE,
            ...INLINE,
            ...(base.contains as Mode[])
        ]
    };
}
