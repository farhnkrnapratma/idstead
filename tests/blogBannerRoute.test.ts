import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { bannerUrl, publicBannerUrl } from '../packages/lib/src/blogBanner.ts';

const postId = '0b6f3c1e-8f5a-4c2b-9d7e-1a2b3c4d5e6f';
const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const publicId = 'a'.repeat(64);

function routeFor(app: string, path: string) {
    const [, blog, banners, , file] = path.split('/');
    expect(`${blog}/${banners}`).toBe('blog/banners');
    expect(file).toEndWith('.webp');
    return new URL(
        `../apps/${app}/src/routes/blog/banners/[postId]/[file]/+server.ts`,
        import.meta.url
    );
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
