// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    compileSearchRegex,
    highlightChunks,
    matchFuzzy
} from '../apps/web/src/lib/components/spotlight/match.ts';

const plain = { caseSensitive: false, wholeWord: false, regex: false };

describe('spotlight matching', () => {
    test('ranks exact, prefix, substring and fuzzy matches', () => {
        expect(matchFuzzy('theme', 'theme', plain).score).toBe(100);
        expect(matchFuzzy('theme dark', 'theme', plain).score).toBe(80);
        expect(matchFuzzy('set theme', 'theme', plain).score).toBe(60);
        expect(matchFuzzy('the mode', 'thmo', plain).matched).toBe(true);
        expect(matchFuzzy('theme', 'xyz', plain).matched).toBe(false);
    });

    test('honours case sensitivity and whole words', () => {
        expect(matchFuzzy('MDRS', 'mdrs', { ...plain, caseSensitive: true }).matched).toBe(false);
        expect(matchFuzzy('MDRS', 'mdrs', plain).matched).toBe(true);
        expect(matchFuzzy('themes', 'theme', { ...plain, wholeWord: true }).matched).toBe(false);
        expect(matchFuzzy('the theme', 'theme', { ...plain, wholeWord: true }).matched).toBe(true);
    });

    test('compiles slash-delimited regex with custom flags', () => {
        const options = { ...plain, regex: true };
        expect(compileSearchRegex('/^t.e/', options)?.flags).toBe('i');
        expect(compileSearchRegex('/^t.e/g', options)?.flags).toBe('g');
        expect(compileSearchRegex('t.e', options)?.flags).toBe('i');
        expect(compileSearchRegex('[', options)).toBeNull();
        expect(matchFuzzy('theme', '^th', options).matched).toBe(true);
    });

    test('highlights every search term', () => {
        expect(highlightChunks('Switch theme mode', 'theme', plain)).toEqual([
            { text: 'Switch ', match: false },
            { text: 'theme', match: true },
            { text: ' mode', match: false }
        ]);
        expect(highlightChunks('Run /goto', '/goto', plain).some(chunk => chunk.match)).toBe(true);
        expect(highlightChunks('text', '   ', plain)).toEqual([{ text: 'text', match: false }]);
    });
});

test('fuzzy matches need the letters close together', () => {
    const flags = { caseSensitive: false, wholeWord: false, regex: false };
    expect(
        matchFuzzy('Toggle distraction-free reading mode for articles', 'mdrs', flags).matched
    ).toBe(false);
    expect(matchFuzzy('markdown rich syntax', 'mrs', flags).matched).toBe(false);
    expect(matchFuzzy('mdx-rs', 'mdrs', flags)).toEqual({ matched: true, score: 50 });
    expect(matchFuzzy('mdrs', 'mdrs', flags).score).toBeGreaterThan(
        matchFuzzy('mdx-rs', 'mdrs', flags).score
    );
});
