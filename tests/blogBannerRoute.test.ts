import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
    bannerSources,
    bannerUrl,
    canonicalBannerKey,
    publicBannerUrl
} from '../packages/lib/src/blogBanner.ts';

const postId = '0b6f3c1e-8f5a-4c2b-9d7e-1a2b3c4d5e6f';
const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const publicId = 'a'.repeat(64);

function routeFor(app: string, path: string) {
    const [, blog, banners, file, extra] = path.split('/');
    expect(`${blog}/${banners}`).toBe('blog/banners');
    expect(file).toMatch(/\.(?:webp|avif)$/);
    expect(extra).toBeUndefined();
    return new URL(`../apps/${app}/src/routes/blog/banners/[file]/+server.ts`, import.meta.url);
}

describe('Blog banner routes', () => {
    test('admin serves the banner path that bannerUrl() builds', () => {
        const route = routeFor('admin', bannerUrl({ id: postId, banner_version: version })!);
        expect(existsSync(route)).toBe(true);
        expect(readFileSync(route, 'utf8')).toContain('serveBlogBanner(');
    });

    test('web serves the banner path that publicBannerUrl() builds', () => {
        const route = routeFor(
            'web',
            publicBannerUrl({ public_id: publicId, banner_version: version })!
        );
        expect(existsSync(route)).toBe(true);
        expect(readFileSync(route, 'utf8')).toContain('serveBlogBanner(');
    });
});

describe('Unversioned blog banner URLs', () => {
    test('URLs carry no version', () => {
        expect(bannerUrl({ id: postId, banner_version: version })).toBe(
            `/blog/banners/${postId}.webp`
        );
        expect(publicBannerUrl({ public_id: publicId, banner_version: version })).toBe(
            `/blog/banners/${publicId}.webp`
        );
        expect(bannerSources({ public_id: publicId, banner_version: version })).toEqual([
            { srcset: `/blog/banners/${publicId}.avif`, type: 'image/avif' },
            { srcset: `/blog/banners/${publicId}.webp`, type: 'image/webp' }
        ]);
        expect(bannerUrl({ id: postId, banner_version: null })).toBeNull();
    });

    test('canonical keys hold one banner per post', () => {
        expect(canonicalBannerKey(postId, 'avif')).toBe(`blog/banners/${postId}.avif`);
        expect(() => canonicalBannerKey('../x', 'webp')).toThrow('Invalid banner identity.');
    });

    test('old versioned routes are gone', () => {
        for (const app of ['web', 'admin'])
            expect(
                existsSync(
                    new URL(
                        `../apps/${app}/src/routes/blog/banners/[postId]/[file]/+server.ts`,
                        import.meta.url
                    )
                )
            ).toBe(false);
    });
});
