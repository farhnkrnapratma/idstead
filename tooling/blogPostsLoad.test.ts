// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, mock, test } from 'bun:test';

const state = { posts: [] as Record<string, unknown>[], fail: false };

mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: () => ({
        blog: {
            listPublishedWithStats: async () => {
                if (state.fail) throw new Error('db');
                return { posts: state.posts };
            },
            readMarkdown: async () => '# Hello\n\nA few words of body text.'
        }
    })
}));

const { loadPublishedPosts } = await import('../packages/lib/src/server/blogPosts.ts');

const post = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1',
    slug: 'hello',
    title: 'Hello &amp; welcome',
    excerpt: 'Intro',
    tags: ['svelte &amp; tests'],
    collaborators: [],
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: null,
    pinned: true,
    comment_count: 3,
    views_count: 9,
    banner_url: null,
    read_minutes: null,
    source: { postId: 'p1', storagePath: 'posts/p1.md' },
    ...overrides
});

test('maps published posts with decoded tags, read time and counts', async () => {
    state.posts = [post(), post({ id: 'p2', slug: 'quick', read_minutes: 2, tags: [] })];
    state.fail = false;
    const posts = await loadPublishedPosts(globalThis.fetch, { limit: 2, pinnedFirst: true });
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({
        id: 'p1',
        slug: 'hello',
        tags: ['svelte & tests'],
        comment_count: 3,
        views_count: 9
    });
    expect(posts[0].read_time).toBeDefined();
    expect(posts[1].read_time).toBeDefined();
});

test('returns nothing when the listing fails', async () => {
    state.fail = true;
    expect(await loadPublishedPosts(globalThis.fetch)).toEqual([]);
});
