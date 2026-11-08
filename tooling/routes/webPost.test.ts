// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

function summary(index: number, extra: Record<string, unknown> = {}) {
    return {
        id: `id-${index}`,
        title: `Post ${index}`,
        slug: `post-${index}`,
        excerpt: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: null,
        read_minutes: 4,
        comment_count: index,
        views_count: index * 10,
        tags: ['a'],
        pinned: false,
        ...extra
    };
}

const state = {
    post: null as Record<string, unknown> | null,
    postError: false,
    render: null as string | null,
    prerendered: null as Record<string, unknown> | null,
    markdown: '## Section\n\nBody' as string | null,
    markdownError: false,
    comments: [] as unknown[],
    commentsError: false,
    posts: [] as unknown[],
    statsError: false,
    license: 'CC0-1.0'
};

const load = ((await import('../../apps/web/src/routes/blog/[slug]/+page.server.ts')) as any)
    .load as (event: unknown) => Promise<any>;

function post(extra: Record<string, unknown> = {}) {
    return {
        id: 'id-2',
        title: 'Post 2',
        slug: 'post-2',
        source: 'posts/post-2.md',
        excerpt: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: null,
        banner_url: 'https://cdn.test/banner.webp',
        banner_credit: { name: 'Photographer' },
        content_license: null,
        tags: [],
        pinned: false,
        ...extra
    };
}

beforeEach(() => {
    state.post = post();
    state.postError = false;
    state.render = null;
    state.prerendered = null;
    state.markdown = '## Section\n\nBody';
    state.markdownError = false;
    state.comments = [];
    state.commentsError = false;
    state.posts = [summary(1), summary(2), summary(3)];
    state.statsError = false;
    slot.parsePostRender = () => state.prerendered;
    slot.publicRepositories = () => ({
        blog: {
            getPublishedBySlug: async () => {
                if (state.postError) throw new Error('db');
                return state.post;
            },
            readRender: async () => state.render,
            readMarkdown: async () => {
                if (state.markdownError) throw new Error('r2');
                return state.markdown;
            },
            listPublishedWithStats: async () => {
                if (state.statsError) throw new Error('db');
                return { posts: state.posts };
            }
        },
        comments: {
            listApproved: async () => {
                if (state.commentsError) throw new Error('db');
                return state.comments;
            }
        },
        site: { contentLicense: async () => ({ license: state.license }) }
    });
});

const run = (slug = 'post-2') =>
    load({
        params: { slug },
        fetch: globalThis.fetch,
        url: new URL('https://ada.test/blog/post-2')
    });

async function failure(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return (error as { status: number }).status;
    }
    return 0;
}

describe('blog post page load', () => {
    test('maps lookup failures to HTTP errors', async () => {
        state.postError = true;
        expect(await failure(run())).toBe(500);
        state.postError = false;
        state.post = null;
        expect(await failure(run())).toBe(404);
    });

    test('uses the stored render when it parses', async () => {
        state.render = '{}';
        state.prerendered = {
            html: '<p>stored</p>',
            headings: [{ id: 'a' }],
            readTime: '9 min read'
        };
        const data = await run();
        expect(data.html).toBe('<p>stored</p>');
        expect(data.post.read_time).toBe('9 min read');
        expect(data.headings).toEqual([{ id: 'a' }]);
    });

    test('renders the markdown when no render is stored or it cannot be parsed', async () => {
        const rendered = await run();
        expect(rendered.html).toContain('<h2');
        expect(rendered.headings.length).toBeGreaterThan(0);
        expect(rendered.post.read_time).toMatch(/min read/);
        state.render = 'garbage';
        expect((await run()).html).toContain('Body');
    });

    test('keeps the error notice when the markdown is unavailable', async () => {
        state.markdown = null;
        expect((await run()).html).toContain('Could not render post content');
        state.markdownError = true;
        expect((await run()).html).toContain('Could not render post content');
    });

    test('returns approved comments and tolerates failures', async () => {
        state.comments = [{ id: 'c1', parent_id: null, author_name: null, content: 'Hi' }];
        const data = await run();
        expect(data.comments).toEqual([
            { id: 'c1', parent_id: null, author_name: '', content: 'Hi', is_approved: true }
        ]);
        state.commentsError = true;
        expect((await run()).comments).toEqual([]);
    });

    test('picks the neighbouring posts as related', async () => {
        const middle = await run();
        expect(middle.relatedPosts.map((related: any) => related.id)).toEqual(['id-1', 'id-3']);
        expect(middle.initialViewsCount).toBe(20);
        state.post = post({ id: 'id-1' });
        expect((await run()).relatedPosts.map((related: any) => related.id)).toEqual([
            'id-2',
            'id-3'
        ]);
        state.post = post({ id: 'id-3' });
        expect((await run()).relatedPosts.map((related: any) => related.id)).toEqual([
            'id-1',
            'id-2'
        ]);
        state.post = post({ id: 'missing' });
        const unlisted = await run();
        expect(unlisted.relatedPosts).toEqual([]);
        expect(unlisted.initialViewsCount).toBe(0);
    });

    test('reads the markdown for related posts without a stored read time', async () => {
        state.posts = [summary(1, { read_minutes: 0 }), summary(2), summary(3)];
        const data = await run();
        expect(data.relatedPosts[0].read_time).toMatch(/min read/);
    });

    test('tolerates a failing related posts query', async () => {
        state.statsError = true;
        const data = await run();
        expect(data.relatedPosts).toEqual([]);
        expect(data.initialViewsCount).toBe(0);
    });

    test('hides the banner credit without a banner', async () => {
        state.post = post({ banner_url: null });
        const data = await run();
        expect(data.bannerCredit).toBeNull();
        expect(data.license).toBeDefined();
    });
});
