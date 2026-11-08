// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import {
    clearHighlightCache,
    highlightChunks
} from '../apps/web/src/lib/components/spotlight/match.ts';

const regex = { caseSensitive: false, wholeWord: false, regex: true };
const plain = { caseSensitive: false, wholeWord: false, regex: false };

test('highlights nothing for invalid or empty regular expressions', () => {
    clearHighlightCache();
    expect(highlightChunks('alpha beta', '/(/', regex)).toEqual([
        { text: 'alpha beta', match: false }
    ]);
    expect(highlightChunks('alpha beta', '//', regex)).toEqual([
        { text: 'alpha beta', match: false }
    ]);
    expect(highlightChunks('alpha beta', '   ', plain)).toEqual([
        { text: 'alpha beta', match: false }
    ]);
});

test('keeps the highlight cache bounded by clearing it when full', () => {
    clearHighlightCache();
    for (let index = 0; index < 501; index++) {
        highlightChunks(`entry ${index} alpha`, 'alpha', plain);
    }
    const again = highlightChunks('entry 0 alpha', 'alpha', plain);
    expect(again.some(chunk => chunk.match && chunk.text === 'alpha')).toBe(true);
});
