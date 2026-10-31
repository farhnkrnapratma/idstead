// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { placeholderKey, replaceLineBlocks } from '../placeholders';
import { escapeHtml } from './attrs';

const VERBATIM_OPEN_RE = /^[ \t]*(:{3,})verbatim\b.*$/i;

const COLON_CLOSE_RE = /^[ \t]*(:{3,})[ \t]*$/;

function replaceVerbatimBlocks(
    markdown: string,
    store: Map<string, string>,
    replace: (content: string, block: string) => { stored: string; output: (key: string) => string }
): string {
    return replaceLineBlocks(
        markdown,
        line => line.match(VERBATIM_OPEN_RE),
        line => line.match(COLON_CLOSE_RE)?.[1] ?? null,
        match => match[1],
        (_match, content, block) => {
            const key = placeholderKey('VERBATIM', store.size);
            const { stored, output } = replace(content, block);
            store.set(key, stored);
            return output(key);
        }
    );
}

export function extractVerbatimBlocks(markdown: string, store: Map<string, string>): string {
    return replaceVerbatimBlocks(markdown, store, content => ({
        stored: `<pre>${escapeHtml(content.trim())}</pre>`,
        output: key => `\n\n${key}\n\n`
    }));
}

export function protectVerbatimBlocks(markdown: string, store: Map<string, string>): string {
    return replaceVerbatimBlocks(markdown, store, (_content, block) => ({
        stored: block,
        output: key => key
    }));
}
