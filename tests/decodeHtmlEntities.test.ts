// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { decodeHtmlEntities } from '../packages/mdrs/core/src/index.ts';

describe('decodeHtmlEntities', () => {
    test('decodes one level only, so an escaped entity stays literal text', () => {
        expect(decodeHtmlEntities('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
        expect(decodeHtmlEntities('&amp;quot;')).toBe('&quot;');
    });

    test('decodes the entities sanitizeInput produces', () => {
        expect(
            decodeHtmlEntities('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#x27;s&lt;/a&gt;')
        ).toBe('<a href="x">Tom & Jerry\'s</a>');
    });

    test('treats missing input as empty', () => {
        expect(decodeHtmlEntities(null)).toBe('');
        expect(decodeHtmlEntities(undefined)).toBe('');
    });
});
