// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

const state = {
    profile: {
        name: 'Ada *Lovelace*',
        username: 'ada',
        headline: 'Engineer\nWriter',
        bio: 'Bio `text`',
        siteUrl: 'https://ada.test/',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
    } as Record<string, unknown> | null,
    profileError: false,
    posts: [] as unknown[],
    postsError: false,
    legal: [] as unknown[] | null
};

function post(index: number, extra: Record<string, unknown> = {}) {
    return {
        id: `id-${index}`,
        slug: `post ${index}`,
        title: `Post [${index}]`,
        excerpt: index % 2 ? `Excerpt ${index}` : null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: null,
        ...extra
    };
}

slot.publicRepositories = () => ({
    author: {
        profile: async () => {
            if (state.profileError) throw new Error('db');
            return state.profile;
        }
    },
    blog: {
        listPublished: async ({ offset }: { offset: number }) => {
            if (state.postsError) throw new Error('db');
            return { posts: state.posts.slice(offset, offset + 500) };
        }
    },
    legal: {
        pages: async () => {
            if (state.legal === null) throw new Error('db');
            return state.legal;
        }
    }
});

const sitemap = await import('../../apps/web/src/routes/sitemap.xml/+server.ts');
const llms = await import('../../apps/web/src/routes/llms.txt/+server.ts');
const wellKnown = await import('../../apps/web/src/routes/.well-known/llms.txt/+server.ts');

function event(path: string, platform: unknown = {}, headers: Record<string, string> = {}) {
    return {
        request: new Request(`https://ada.test${path}`, { headers }),
        fetch: globalThis.fetch,
        platform
    } as any;
}

async function status(promise: Promise<Response>) {
    try {
        return (await promise).status;
    } catch (error) {
        return (error as { status: number }).status;
    }
}

beforeEach(() => {
    state.profileError = false;
    state.postsError = false;
    state.posts = [];
    state.legal = [];
    state.profile = {
        name: 'Ada *Lovelace*',
        username: 'ada',
        headline: 'Engineer\nWriter',
        bio: 'Bio `text`',
        siteUrl: 'https://ada.test/',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
    };
});

describe('GET /sitemap.xml', () => {
    const { GET } = sitemap as any;

    test('lists the fixed pages, legal pages and posts', async () => {
        state.legal = [
            { slug: 'terms', title: 'Terms', content: 'x', updated_at: '2026-03-01T00:00:00Z' },
            { slug: 'privacy', title: '', content: '', updated_at: 'bad' }
        ];
        state.posts = [post(1), post(2, { updated_at: '2026-04-01T00:00:00.000Z' })];
        const response = await GET(event('/sitemap.xml'));
        const body = await response.text();
        expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
        expect(body).toContain('<loc>https://ada.test/</loc>');
        expect(body).toContain('<loc>https://ada.test/feedback</loc>');
        expect(body).toContain('<loc>https://ada.test/blog/post%201</loc>');
        expect(body).toContain('<lastmod>2026-04-01T00:00:00.000Z</lastmod>');
        expect(body).toContain('<lastmod>2026-02-01T00:00:00.000Z</lastmod>');
        expect(body).toContain('<loc>https://ada.test/terms</loc>');
    });

    test('is empty before a profile exists and falls back to the configured origin', async () => {
        state.profile = null;
        const body = await (
            await GET(event('/sitemap.xml', { env: { PUBLIC_SITE_URL: 'https://cfg.test/' } }))
        ).text();
        expect(body).not.toContain('<url>');
    });

    test('fails closed when sources are unavailable', async () => {
        state.legal = null;
        expect(await status(GET(event('/sitemap.xml')))).toBe(503);
        state.legal = [];
        state.profileError = true;
        expect(await status(GET(event('/sitemap.xml')))).toBe(503);
        state.profileError = false;
        state.postsError = true;
        expect(await status(GET(event('/sitemap.xml')))).toBe(503);
        state.postsError = false;
        state.profile = null;
        expect(await status(GET(event('/sitemap.xml')))).toBe(503);
    });

    test('rejects bad pages and honors conditional requests', async () => {
        for (const page of ['-1', '1.5', 'x', '5'])
            expect(await status(GET(event(`/sitemap.xml?page=${page}`)))).toBe(404);
        const first = await GET(event('/sitemap.xml'));
        const etag = first.headers.get('etag')!;
        const again = await GET(event('/sitemap.xml', {}, { 'if-none-match': etag }));
        expect(again.status).toBe(304);
    });

    test('splits large sitemaps into an index and pages', async () => {
        state.posts = Array.from({ length: 10_001 }, (_, index) => post(index));
        const index = await (await GET(event('/sitemap.xml'))).text();
        expect(index).toContain('<sitemapindex');
        expect(index).toContain('https://ada.test/sitemap.xml?page=2');
        const second = await (await GET(event('/sitemap.xml?page=2'))).text();
        expect(second).toContain('<urlset');
        expect(second.match(/<url>/g)!.length).toBeLessThan(10_000);
    });
});

describe('GET /llms.txt', () => {
    const { GET } = llms as any;

    test('serves the same handler under .well-known', () => {
        expect((wellKnown as any).GET).toBe(GET);
    });

    test('describes an instance that is being set up', async () => {
        state.profile = null;
        const response = await GET(
            event('/llms.txt', { env: { PUBLIC_SITE_URL: 'https://x.test' } })
        );
        expect(await response.text()).toContain('This site is being set up.');
    });

    test('lists posts, with and without an excerpt', async () => {
        state.posts = [post(1), post(2), post(3, { created_at: 'bad' })];
        const text = await (await GET(event('/llms.txt'))).text();
        expect(text).toContain('# Ada \\*Lovelace\\* — Engineer Writer');
        expect(text).toContain('[Post \\[1\\]](https://ada.test/blog/post%201.md)');
        expect(text).toContain('— Excerpt 1');
        expect(text).toContain('Published on unknown.');
        expect(text).toContain('Published on 2026-02-01.');
    });

    test('notes when there are no posts', async () => {
        expect(await (await GET(event('/llms.txt'))).text()).toContain(
            '*No published posts available.*'
        );
    });
});
