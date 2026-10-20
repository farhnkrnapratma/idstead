import { describe, expect, test } from 'bun:test';
import type { BlogRepository, CommentRepository, Writers } from '../../packages/data/src/index.ts';

export interface SeedPost {
    uuid: string;
    publicId: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    published: boolean;
    createdAt: string;
    pinned?: boolean;
    tags?: string[];
    readMinutes?: number | null;
    markdown?: string;
    render?: string;
}

export interface SeedComment {
    uuid: string;
    publicId: string;
    postUuid: string;
    parentUuid?: string | null;
    approved: boolean;
    author: string;
    anonymous?: boolean;
    createdAt: string;
}

export interface ContractSeed {
    posts: SeedPost[];
    comments: SeedComment[];
    views: Array<{ postUuid: string }>;
}

export type RepositoryFactory = (seed: ContractSeed) => {
    blog: BlogRepository;
    comments: CommentRepository;
    writers: Pick<Writers, 'comments' | 'views'>;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hex = (char: string, prefix = '') => prefix + char.repeat(64 - prefix.length);

export const SEED: ContractSeed = {
    posts: [
        {
            uuid: uuid(1),
            publicId: hex('1', 'aaaaaaaa'),
            slug: 'newest',
            title: 'Newest Svelte post',
            excerpt: 'All about runes',
            published: true,
            createdAt: '2026-10-05T00:00:00Z',
            tags: ['svelte'],
            readMinutes: 4,
            markdown: '# Newest',
            render: '{"version":1}'
        },
        {
            uuid: uuid(2),
            publicId: hex('2', 'aaaaaaaa'),
            slug: 'middle',
            title: 'Middle post',
            excerpt: '100% off_topic',
            published: true,
            createdAt: '2026-10-03T00:00:00Z',
            pinned: true
        },
        {
            uuid: uuid(3),
            publicId: hex('3', 'c0ffee'),
            slug: 'c0ffee3',
            title: 'Oldest post',
            published: true,
            createdAt: '2026-10-01T00:00:00Z'
        },
        {
            uuid: uuid(4),
            publicId: hex('4'),
            slug: 'draft',
            title: 'Draft Svelte post',
            published: false,
            createdAt: '2026-10-06T00:00:00Z'
        }
    ],
    comments: [
        {
            uuid: uuid(11),
            publicId: hex('b'),
            postUuid: uuid(1),
            approved: true,
            author: 'Ann',
            createdAt: '2026-10-05T01:00:00Z'
        },
        {
            uuid: uuid(12),
            publicId: hex('c'),
            postUuid: uuid(1),
            parentUuid: uuid(11),
            approved: true,
            author: 'Real Name',
            anonymous: true,
            createdAt: '2026-10-05T02:00:00Z'
        },
        {
            uuid: uuid(13),
            publicId: hex('d'),
            postUuid: uuid(1),
            approved: false,
            author: 'Held',
            createdAt: '2026-10-05T03:00:00Z'
        },
        {
            uuid: uuid(14),
            publicId: hex('e'),
            postUuid: uuid(4),
            approved: true,
            author: 'On a draft',
            createdAt: '2026-10-06T01:00:00Z'
        }
    ],
    views: [{ postUuid: uuid(1) }, { postUuid: uuid(1) }, { postUuid: uuid(2) }]
};

export function blogRepositoryContract(name: string, factory: RepositoryFactory) {
    describe(`${name}: BlogRepository contract`, () => {
        const { blog, comments } = factory(SEED);

        test('lists published posts only, newest first', async () => {
            const { posts, total } = await blog.listPublished();
            expect(posts.map(p => p.slug)).toEqual(['newest', 'middle', 'c0ffee3']);
            expect(total).toBe(3);
            expect(posts[0].id).toBe(SEED.posts[0].publicId);
            expect(posts[1].pinned).toBe(true);
            expect(posts[0].read_minutes).toBe(4);
        });

        test('paginates with a stable total and an empty page past the end', async () => {
            const page = await blog.listPublished({ limit: 2, offset: 2 });
            expect(page.posts.map(p => p.slug)).toEqual(['c0ffee3']);
            expect(page.total).toBe(3);
            const past = await blog.listPublished({ limit: 2, offset: 10 });
            expect(past).toEqual({ posts: [], total: 3 });
        });

        test('searches titles and excerpts case-insensitively and literally', async () => {
            expect((await blog.listPublished({ search: 'SVELTE' })).posts.map(p => p.slug)).toEqual(
                ['newest']
            );
            expect((await blog.listPublished({ search: 'runes' })).total).toBe(1);
            expect((await blog.listPublished({ search: '100%' })).posts.map(p => p.slug)).toEqual([
                'middle'
            ]);
            expect((await blog.listPublished({ search: '1_0' })).total).toBe(0);
        });

        test('counts approved comments and views per post', async () => {
            const { posts } = await blog.listPublishedWithStats();
            const bySlug = Object.fromEntries(posts.map(p => [p.slug, p]));
            expect(bySlug.newest.comment_count).toBe(2);
            expect(bySlug.newest.views_count).toBe(2);
            expect(bySlug.middle.views_count).toBe(1);
            expect(bySlug.c0ffee3.comment_count).toBe(0);
            const post = (await blog.getPublishedBySlug('newest'))!;
            expect(await blog.postStats(post)).toEqual({ comment_count: 2, views_count: 2 });
        });

        test('finds posts by public ID, slug and unique prefix, preferring a slug', async () => {
            const byId = await blog.findPublished(SEED.posts[0].publicId);
            expect(byId.status === 'found' && byId.post.slug).toBe('newest');
            const bySlug = await blog.findPublished('middle');
            expect(bySlug.status === 'found' && bySlug.post.id).toBe(SEED.posts[1].publicId);
            const byPrefix = await blog.findPublished(SEED.posts[2].publicId.slice(0, 8));
            expect(byPrefix.status === 'found' && byPrefix.post.slug).toBe('c0ffee3');
            const slugFirst = await blog.findPublished('c0ffee3');
            expect(slugFirst.status === 'found' && slugFirst.post.slug).toBe('c0ffee3');
            expect(await blog.findPublished('aaaaaaaa')).toEqual({ status: 'ambiguous' });
            expect(await blog.findPublished('Not A Slug!')).toEqual({ status: 'invalid' });
            expect(await blog.findPublished('draft')).toEqual({ status: 'not-found' });
            expect(await blog.findPublished(SEED.posts[3].publicId)).toEqual({
                status: 'not-found'
            });
            expect(await blog.getPublishedBySlug('draft')).toBeNull();
        });

        test('reads content through the post source', async () => {
            const newest = (await blog.getPublishedBySlug('newest'))!;
            expect(await blog.readMarkdown(newest.source)).toBe('# Newest');
            expect(await blog.readRender(newest.source)).toBe('{"version":1}');
            const oldest = (await blog.getPublishedBySlug('c0ffee3'))!;
            expect(await blog.readMarkdown(oldest.source)).toBeNull();
        });

        test('lists approved comments with public IDs and anonymised names', async () => {
            const post = (await blog.getPublishedBySlug('newest'))!;
            const list = await comments.listApproved(post);
            expect(list.map(c => [c.id, c.parent_id, c.author_name])).toEqual([
                [SEED.comments[0].publicId, null, 'Ann'],
                [SEED.comments[1].publicId, SEED.comments[0].publicId, 'Anonymous']
            ]);
        });

        test('lists recent approved comments on published posts only', async () => {
            const recent = await comments.listRecentApproved(10);
            expect(recent.map(c => [c.post.slug, c.is_reply])).toEqual([
                ['newest', true],
                ['newest', false]
            ]);
        });

        test('never exposes database UUIDs', async () => {
            const post = (await blog.getPublishedBySlug('newest'))!;
            const output = JSON.stringify([
                await blog.listPublishedWithStats(),
                await blog.findPublished('newest'),
                await comments.listApproved(post),
                await comments.listRecentApproved(10)
            ]);
            expect(output).not.toMatch(UUID);
        });
    });

    describe(`${name}: write contract`, () => {
        test('creates a comment and lists it only once approved', async () => {
            const { blog, comments, writers } = factory(SEED);
            const post = (await blog.getPublishedBySlug('newest'))!;
            const held = await writers.comments.create(post, {
                parentId: null,
                authorName: 'Guest',
                content: 'Held back',
                approved: false
            });
            const shown = await writers.comments.create(post, {
                parentId: null,
                authorName: 'Guest',
                content: 'Shown',
                approved: true
            });
            expect(held.status === 'created' && held.comment.is_approved).toBe(false);
            expect(shown.status).toBe('created');
            if (shown.status !== 'created') return;
            expect(shown.comment.id).toMatch(/^[0-9a-f]{64}$/);
            expect(shown.comment).toMatchObject({
                parent_id: null,
                author_name: 'Guest',
                content: 'Shown',
                is_admin: false,
                is_anonymous: false,
                is_approved: true
            });
            const listed = (await comments.listApproved(post)).map(comment => comment.content);
            expect(listed).toContain('Shown');
            expect(listed).not.toContain('Held back');
            expect(await blog.postStats(post)).toMatchObject({ comment_count: 3 });
            expect(JSON.stringify(shown)).not.toMatch(UUID);
        });

        test('accepts replies only to approved comments on the same post', async () => {
            const { blog, writers } = factory(SEED);
            const newest = (await blog.getPublishedBySlug('newest'))!;
            const middle = (await blog.getPublishedBySlug('middle'))!;
            const reply = await writers.comments.create(newest, {
                parentId: SEED.comments[0].publicId,
                authorName: 'Guest',
                content: 'Reply',
                approved: true
            });
            expect(reply.status === 'created' && reply.comment.parent_id).toBe(
                SEED.comments[0].publicId
            );
            for (const parentId of [SEED.comments[2].publicId, hex('9')]) {
                expect(
                    await writers.comments.create(newest, {
                        parentId,
                        authorName: 'Guest',
                        content: 'Reply',
                        approved: true
                    })
                ).toEqual({ status: 'invalid-parent' });
            }
            expect(
                await writers.comments.create(middle, {
                    parentId: SEED.comments[0].publicId,
                    authorName: 'Guest',
                    content: 'Reply',
                    approved: true
                })
            ).toEqual({ status: 'invalid-parent' });
        });

        test('reports existing comments by public ID', async () => {
            const { writers } = factory(SEED);
            const report = { reason: 'spam', details: null, reporterIpHash: 'a'.repeat(64) };
            expect(await writers.comments.report(SEED.comments[0].publicId, report)).toBe(
                'reported'
            );
            expect(await writers.comments.report(hex('9'), report)).toBe('not-found');
        });

        test('counts a visitor once per key and keeps the public count in step', async () => {
            const { blog, writers } = factory(SEED);
            const post = (await blog.getPublishedBySlug('middle'))!;
            expect(await writers.views.record(post, 'day1_visitor')).toEqual({
                counted: true,
                views: 2
            });
            expect(await writers.views.record(post, 'day1_visitor')).toEqual({
                counted: false,
                views: 2
            });
            expect(await writers.views.record(post, 'day2_visitor')).toEqual({
                counted: true,
                views: 3
            });
            const listed = (await blog.listPublishedWithStats()).posts.find(
                item => item.slug === 'middle'
            );
            expect(listed?.views_count).toBe(3);
        });
    });
}
