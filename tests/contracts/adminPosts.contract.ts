// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { AdminPostStore, PostCleanupStore } from '../../packages/data/src/index.ts';

export interface SeedAdminPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    pinned: boolean;
    excerpt: string | null;
    createdAt: string;
    readMinutes: number | null;
    views: number;
    comments: number;
    markdown: string | null;
}

export interface AdminPostSeed {
    posts: SeedAdminPost[];
    pendingMarkdown: Array<{ path: string; attempts: number; createdAt: string }>;
}

export type AdminPostStoresFactory = (seed: AdminPostSeed) => {
    posts: AdminPostStore;
    cleanup: PostCleanupStore;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const markdownPath = (post: number, operation: number) =>
    `posts/${uuid(post)}/${uuid(operation)}.md`;

const post = (n: number, fields: Partial<SeedAdminPost>): SeedAdminPost => ({
    id: uuid(n),
    title: `Post ${n}`,
    slug: `post-${n}`,
    published: false,
    pinned: false,
    excerpt: null,
    createdAt: `2026-10-0${n}T00:00:00Z`,
    readMinutes: null,
    views: 0,
    comments: 0,
    markdown: null,
    ...fields
});

const ADMIN_POST_SEED: AdminPostSeed = {
    posts: [
        post(1, {
            published: true,
            pinned: true,
            excerpt: 'First',
            readMinutes: 3,
            views: 12,
            comments: 2,
            markdown: '# First'
        }),
        post(2, { excerpt: '   ', markdown: '# Draft' }),
        post(3, { published: true, pinned: true, excerpt: 'Third' }),
        post(4, { published: true, pinned: true, excerpt: 'Fourth' })
    ],
    pendingMarkdown: [
        { path: markdownPath(1, 90), attempts: 0, createdAt: '2026-10-01T00:00:00Z' },
        { path: markdownPath(1, 91), attempts: 2, createdAt: '2099-01-01T00:00:00Z' }
    ]
};

export function adminPostContract(name: string, factory: AdminPostStoresFactory) {
    describe(`AdminPostStore contract: ${name}`, () => {
        test('lists every post newest first with counts and read time', async () => {
            const posts = await factory(ADMIN_POST_SEED).posts.list();
            expect(posts.map(item => item.slug)).toEqual(['post-4', 'post-3', 'post-2', 'post-1']);
            const first = posts.find(item => item.id === uuid(1))!;
            expect(first).toMatchObject({
                published: true,
                pinned: true,
                read_minutes: 3,
                views_count: 12,
                comment_count: 2,
                tags: []
            });
            expect(posts.find(item => item.id === uuid(2))!.read_minutes).toBeNull();
        });

        test('loads a post with its markdown for editing', async () => {
            const stores = factory(ADMIN_POST_SEED);
            expect(await stores.posts.get(uuid(1))).toMatchObject({
                id: uuid(1),
                slug: 'post-1',
                collaborators: [],
                markdown: '# First'
            });
            expect(await stores.posts.get(uuid(9))).toBeNull();
        });

        test('reports asset state, slug ownership and existence', async () => {
            const { posts } = factory(ADMIN_POST_SEED);
            expect(await posts.assetState(uuid(2))).toEqual({
                id: uuid(2),
                slug: 'post-2',
                published: false,
                banner_version: null
            });
            expect(await posts.assetState(uuid(9))).toBeNull();
            expect(await posts.slugTaken('post-1', uuid(2))).toBe(true);
            expect(await posts.slugTaken('post-1', uuid(1))).toBe(false);
            expect(await posts.exists(uuid(3))).toBe(true);
            expect(await posts.exists(uuid(9))).toBe(false);
        });

        test('updates publication and pin flags', async () => {
            const { posts } = factory(ADMIN_POST_SEED);
            const unpinned = await posts.setFlags(uuid(1), { pinned: false });
            expect(unpinned).toMatchObject({
                status: 'updated',
                post: { id: uuid(1), pinned: false, published: true }
            });
            const unpublished = await posts.setFlags(uuid(3), { published: false });
            expect(unpublished).toMatchObject({ status: 'updated', post: { published: false } });
            expect((await posts.list()).find(item => item.id === uuid(3))!.published).toBe(false);
            expect(await posts.setFlags(uuid(9), { published: true })).toEqual({
                status: 'not-found'
            });
        });

        test('refuses to publish without an excerpt or pin a fourth post', async () => {
            const { posts } = factory(ADMIN_POST_SEED);
            expect(await posts.setFlags(uuid(2), { published: true })).toEqual({
                status: 'excerpt-required'
            });
            expect(await posts.setFlags(uuid(2), { pinned: true })).toEqual({
                status: 'pin-limit'
            });
            expect((await posts.get(uuid(2)))!.published).toBe(false);
        });
    });

    describe(`PostCleanupStore contract: ${name}`, () => {
        test('returns queued markdown older than the cutoff', async () => {
            const { cleanup } = factory(ADMIN_POST_SEED);
            expect(await cleanup.pendingMarkdown(new Date('2026-10-02T00:00:00Z'), 20)).toEqual([
                { storage_path: markdownPath(1, 90), cleanup_attempts: 0 }
            ]);
        });

        test('removes queue entries and records failed attempts', async () => {
            const { cleanup } = factory(ADMIN_POST_SEED);
            const [item] = await cleanup.pendingMarkdown(new Date('2100-01-01T00:00:00Z'), 20);
            await cleanup.markdownFailed(item);
            const after = await cleanup.pendingMarkdown(new Date('2100-01-01T00:00:00Z'), 20);
            expect(after.find(row => row.storage_path === item.storage_path)).toEqual({
                storage_path: item.storage_path,
                cleanup_attempts: item.cleanup_attempts + 1
            });
            await cleanup.markdownRemoved(item.storage_path);
            expect(
                (await cleanup.pendingMarkdown(new Date('2100-01-01T00:00:00Z'), 20)).map(
                    row => row.storage_path
                )
            ).not.toContain(item.storage_path);
        });

        test('reports whether a markdown file is still referenced', async () => {
            const { cleanup } = factory(ADMIN_POST_SEED);
            expect(await cleanup.markdownInUse(markdownPath(1, 1))).toBe(true);
            expect(await cleanup.markdownInUse(markdownPath(1, 90))).toBe(false);
        });
    });
}
