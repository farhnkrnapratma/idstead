// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    avifSources,
    bannerObjectKey,
    bannerSources,
    bannerUrl,
    postAssetHome,
    publicBannerUrl
} from '../packages/lib/src/blogBanner.ts';

const postId = '0b6f3c1e-8f5a-4c2b-9d7e-1a2b3c4d5e6f';
const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const cdn = 'https://cdn.example.com';

describe('Blog banner URLs on the CDN', () => {
    test('published posts live in blog/{slug}/', () => {
        const post = { id: postId, slug: 'ubuntu-26-10', published: true, banner_version: version };
        expect(postAssetHome(post)).toBe('blog/ubuntu-26-10');
        expect(publicBannerUrl(post, cdn)).toBe(`${cdn}/blog/ubuntu-26-10/banner.webp`);
        expect(bannerSources(post, cdn)).toEqual([
            { srcset: `${cdn}/blog/ubuntu-26-10/banner.avif`, type: 'image/avif' }
        ]);
    });

    test('drafts live in the staging folder', () => {
        const post = { id: postId, slug: 'draft', published: false, banner_version: version };
        expect(bannerUrl(post, cdn)).toBe(`${cdn}/staging/blog/${postId}/banner.webp`);
        expect(bannerObjectKey(post, 'avif')).toBe(`staging/blog/${postId}/banner.avif`);
    });

    test('no banner, no URL', () => {
        expect(bannerUrl({ id: postId, slug: 'x', published: true }, cdn)).toBeNull();
        expect(avifSources(null)).toEqual([]);
    });

    test('invalid ids and slugs never reach a key', () => {
        expect(() => postAssetHome({ id: '../x' })).toThrow('Invalid banner identity.');
        expect(postAssetHome({ id: postId, slug: '../etc', published: true })).toBe(
            `staging/blog/${postId}`
        );
    });

    test('the Worker banner and content routes are gone', async () => {
        for (const path of [
            '../apps/web/src/routes/blog/banners/[file]/+server.ts',
            '../apps/admin/src/routes/blog/banners/[file]/+server.ts',
            '../apps/web/src/routes/blog/content/[file]/+server.ts'
        ])
            expect(await Bun.file(new URL(path, import.meta.url)).exists()).toBe(false);
    });
});

describe('Reserved post slugs', () => {
    test('banners and content never become a post folder', async () => {
        const { isValidPostSlug, slugifyTitle } = await import('../packages/domain/src/slug.ts');
        expect(isValidPostSlug('banners')).toBe(false);
        expect(isValidPostSlug('content')).toBe(false);
        expect(slugifyTitle('Banners')).toBe('banners-post');
        expect(slugifyTitle('Content')).toBe('content-post');
        expect(postAssetHome({ id: postId, slug: 'banners', published: true })).toBe(
            `staging/blog/${postId}`
        );
    });
});
