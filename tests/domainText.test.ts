// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { publicCommentAuthor, publicPostFields } from '../packages/domain/src/blog.ts';
import { isLegalSlug, publishedLegalSlugs } from '../packages/domain/src/legal.ts';
import {
    extractAuthorNameTokens,
    isNameReserved,
    normalizeName
} from '../packages/domain/src/nameValidator.ts';
import { sanitizeInput } from '../packages/domain/src/sanitizeInput.ts';
import { escapeXml } from '../packages/domain/src/xml.ts';

describe('normalizeName', () => {
    test('folds case, accents, homoglyphs and punctuation', () => {
        expect(normalizeName('  Ádmin ')).toBe('admin');
        expect(normalizeName('аdmіn')).toBe('admin');
        expect(normalizeName('M0d-3rator!')).toBe('mod3rator');
    });
});

describe('isNameReserved', () => {
    test('rejects staff-like names and honours extra reserved names', () => {
        expect(isNameReserved('Site Admin')).toBe(true);
        expect(isNameReserved('mod')).toBe(true);
        expect(isNameReserved('the mod squad')).toBe(true);
        expect(isNameReserved('moderate')).toBe(false);
        expect(isNameReserved('Alice')).toBe(false);
        expect(isNameReserved('farhan', ['', 'ab', 'Farhan'])).toBe(true);
        expect(isNameReserved('abx', ['ab'])).toBe(false);
    });
});

describe('extractAuthorNameTokens', () => {
    test('returns nothing without an author and splits names into long parts', () => {
        expect(extractAuthorNameTokens(null)).toEqual([]);
        expect(extractAuthorNameTokens(undefined)).toEqual([]);
        expect(extractAuthorNameTokens({})).toEqual([]);
        expect(extractAuthorNameTokens({ username: 'fk', name: 'Farhan K. Pratama' })).toEqual([
            'fk',
            'Farhan K. Pratama',
            'Farhan',
            'Pratama'
        ]);
    });
});

describe('escaping', () => {
    test('sanitizeInput and escapeXml escape markup and tolerate empty input', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(`<a href="x">'&'/</a>`)).toBe(
            '&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&#x2F;&lt;&#x2F;a&gt;'
        );
        expect(escapeXml('')).toBe('');
        expect(escapeXml(`<a b="c">'&'</a>`)).toBe(
            '&lt;a b=&quot;c&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;'
        );
    });
});

describe('public blog fields', () => {
    test('hides anonymous authors and copies only public post fields', () => {
        expect(publicCommentAuthor({ author_name: 'Ann', is_anonymous: true })).toBe('Anonymous');
        expect(publicCommentAuthor({ author_name: 'Ann', is_anonymous: false })).toBe('Ann');
        const post = {
            id: '1',
            title: 'T',
            slug: 't',
            pinned: false,
            created_at: 'a',
            updated_at: null,
            excerpt: null,
            tags: ['x'],
            collaborators: [],
            secret: 'no'
        };
        expect(publicPostFields(post)).toEqual({
            id: '1',
            title: 'T',
            slug: 't',
            pinned: false,
            created_at: 'a',
            updated_at: null,
            excerpt: null,
            tags: ['x'],
            collaborators: []
        });
    });
});

describe('legal slugs', () => {
    test('recognises slugs and lists only pages with content', () => {
        expect(isLegalSlug('privacy')).toBe(true);
        expect(isLegalSlug('cookies')).toBe(false);
        expect(
            publishedLegalSlugs([
                { slug: 'privacy', content: 'text' },
                { slug: 'terms', content: '  ' },
                { slug: 'security', content: null },
                { slug: 'ai-disclosure' },
                { slug: 'other', content: 'x' }
            ])
        ).toEqual(['privacy']);
    });
});
