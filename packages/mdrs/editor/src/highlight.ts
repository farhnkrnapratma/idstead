// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import hljs from 'highlight.js';
import { mdrsLanguage } from '@mdrs/dom/mdrsHighlight.ts';

hljs.registerLanguage('mdrs', mdrsLanguage);

function escapeHtml(code: string): string {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightMarkdown(code: string): string {
    try {
        return hljs.highlight(code, { language: 'mdrs' }).value;
    } catch {
        return escapeHtml(code);
    }
}
