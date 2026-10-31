// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({}));

const { publicHref, publicSiteUrl } = await import('../apps/admin/src/lib/publicSite.ts');

describe('admin public site links', () => {
    test('points site paths at the public site instead of the admin host', () => {
        expect(publicHref('https://example.com', '/blog/my-post')).toBe(
            'https://example.com/blog/my-post'
        );
    });

    test('leaves absolute and protocol-relative links alone', () => {
        expect(publicHref('https://example.com', 'https://other.example/x')).toBe(
            'https://other.example/x'
        );
        expect(publicHref('https://example.com', '//evil.example/x')).toBe('//evil.example/x');
    });

    test('uses the profile site URL, falling back to PUBLIC_SITE_URL', () => {
        expect(publicSiteUrl({ author: { siteUrl: 'https://example.com/' } })).toBe(
            'https://example.com'
        );
        expect(publicSiteUrl({}, 'https://fallback.example.com/')).toBe(
            'https://fallback.example.com'
        );
        expect(publicSiteUrl(null, 'https://fallback.example.com/')).toBe(
            'https://fallback.example.com'
        );
        expect(publicSiteUrl(null, undefined)).toBe('');
    });
});
