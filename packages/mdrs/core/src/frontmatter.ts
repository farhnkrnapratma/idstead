// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { load } from 'js-yaml';

const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export interface Frontmatter {
    data: Record<string, unknown> | null;
    body: string;
    error?: string;
}

export function extractFrontmatter(markdown: string): Frontmatter {
    const match = markdown.match(FRONTMATTER_RE);
    if (!match) return { data: null, body: markdown };
    let parsed: unknown;
    try {
        parsed = match[1].trim() ? load(match[1], { maxDepth: 16 }) : {};
    } catch (error) {
        const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
        return { data: null, body: markdown, error: `Frontmatter is not valid YAML: ${reason}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
            data: null,
            body: markdown,
            error: 'Frontmatter must be a YAML mapping of keys to values.'
        };
    }
    return { data: parsed as Record<string, unknown>, body: markdown.slice(match[0].length) };
}

export interface ImportedPost {
    title?: string;
    excerpt?: string;
    tags?: string[];
    body: string;
    ignored: string[];
    error?: string;
}

const POST_FIELDS = new Set(['title', 'excerpt', 'tags']);

function readTags(value: unknown): string[] | undefined {
    const items =
        Array.isArray(value) ? value
        : typeof value === 'string' ? value.split(',')
        : null;
    if (!items) return undefined;
    return items
        .filter(item => typeof item === 'string' || typeof item === 'number')
        .map(item => String(item).trim())
        .filter(Boolean);
}

export function importPostDocument(text: string): ImportedPost {
    const { data, body, error } = extractFrontmatter(text);
    if (!data) return { body: text, ignored: [], error };
    return {
        title: typeof data.title === 'string' ? data.title.trim() : undefined,
        excerpt: typeof data.excerpt === 'string' ? data.excerpt.trim() : undefined,
        tags: readTags(data.tags),
        body: body.replace(/^(?:[ \t]*\r?\n)+/, ''),
        ignored: Object.keys(data).filter(key => !POST_FIELDS.has(key))
    };
}
