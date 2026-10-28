import { describe, expect, test } from 'bun:test';
import {
    createD1AdminPostStore,
    createD1PostCleanupStore,
    createD1PostOperationStore
} from '../packages/data/src/d1/adminPosts.ts';
import { DataError } from '../packages/data/src/errors.ts';
import {
    adminPostContract,
    markdownPath,
    type AdminPostSeed
} from './contracts/adminPosts.contract.ts';
import { d1Shim, insertRows, memoryBucket } from './support/d1.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = 'a'.repeat(64);

function stores(seed: AdminPostSeed = { posts: [], pendingMarkdown: [] }) {
    const shim = d1Shim();
    const bucket = memoryBucket();
    insertRows(
        shim.sqlite,
        'db_posts',
        seed.posts.map((post, index) => {
            const storagePath = markdownPath(index + 1, index + 1);
            if (post.markdown !== null) bucket.objects[`content/${storagePath}`] = post.markdown;
            return {
                id: post.id,
                title: post.title,
                slug: post.slug,
                published: post.published,
                pinned: post.pinned,
                excerpt: post.excerpt,
                created_at: post.createdAt,
                storage_path: storagePath,
                post_revision: 1,
                read_time: post.readMinutes
            };
        })
    );
    insertRows(
        shim.sqlite,
        'db_views',
        seed.posts.flatMap(post =>
            Array.from({ length: post.views }, (_, n) => ({ post_id: post.id, ip_hash: `v${n}` }))
        )
    );
    insertRows(
        shim.sqlite,
        'db_comments',
        seed.posts.flatMap(post =>
            Array.from({ length: post.comments }, () => ({
                post_id: post.id,
                author_name: 'Ann',
                content: 'Hi',
                is_admin: true
            }))
        )
    );
    insertRows(
        shim.sqlite,
        'db_post_storage_cleanup',
        seed.pendingMarkdown.map(item => ({
            storage_path: item.path,
            post_id: uuid(1),
            cleanup_attempts: item.attempts,
            created_at: item.createdAt
        }))
    );
    return {
        ...shim,
        bucket,
        posts: createD1AdminPostStore(shim.db, bucket),
        operations: createD1PostOperationStore(shim.db, bucket),
        cleanup: createD1PostCleanupStore(shim.db, bucket)
    };
}

adminPostContract('D1 adapter', stores);

const ACTOR = uuid(500);

function request(n: number, fields: Record<string, unknown> = {}) {
    return {
        operationId: uuid(100 + n),
        actor: ACTOR,
        postId: uuid(1),
        hash: String(n).repeat(64).slice(0, 64),
        revision: null as number | null,
        kind: 'save' as const,
        post: {
            title: 'Hello',
            slug: 'hello',
            excerpt: 'Hi',
            published: true,
            tags: ['svelte'],
            collaborators: []
        },
        banner: { operation: 'keep' } as { operation: string } & Record<string, unknown>,
        ...fields
    };
}

async function save(s: ReturnType<typeof stores>, input: ReturnType<typeof request>) {
    const prepared = await s.operations.prepare(input);
    if (prepared.status !== 'prepared') return prepared;
    if (prepared.operation.state !== 'pending') return prepared.operation;
    await s.operations.writeMarkdown(input.postId, input.operationId, '# Hello');
    await s.operations.ready(input.operationId, ACTOR);
    return s.operations.commit(input.operationId, ACTOR);
}

describe('D1 post operations', () => {
    test('creates a post, updates it at the expected revision and replays committed operations', async () => {
        const s = stores();
        const created = await save(s, request(1));
        expect(created).toMatchObject({
            state: 'committed',
            result: {
                id: uuid(1),
                post_revision: 1,
                slug: 'hello',
                published: true,
                banner_version: null
            }
        });
        expect(await s.posts.get(uuid(1))).toMatchObject({
            title: 'Hello',
            tags: ['svelte'],
            markdown: '# Hello'
        });
        expect(await s.operations.commit(uuid(101), ACTOR)).toMatchObject({ state: 'committed' });
        const updated = await save(
            s,
            request(2, { revision: 1, post: { ...request(2).post, title: 'Hello again' } })
        );
        expect(updated).toMatchObject({ state: 'committed', result: { post_revision: 2 } });
        expect(s.sqlite.query('select storage_path from db_post_storage_cleanup').all()).toEqual([
            { storage_path: markdownPath(1, 101) }
        ]);
        expect(await s.operations.find(uuid(102), ACTOR)).toMatchObject({ state: 'committed' });
        expect(await s.operations.find(uuid(102), uuid(9))).toBeNull();
    });

    test('marks stale revisions as conflicts and refuses a reused operation ID', async () => {
        const s = stores();
        await save(s, request(1));
        expect(await save(s, request(2, { revision: 7 }))).toMatchObject({ state: 'conflict' });
        expect(await save(s, request(3))).toMatchObject({ state: 'conflict' });
        expect(await s.operations.prepare({ ...request(1), hash: 'f'.repeat(64) })).toEqual({
            status: 'reused'
        });
        const prepared = await s.operations.prepare(request(4, { revision: 1 }));
        expect(prepared).toMatchObject({ status: 'prepared', operation: { state: 'pending' } });
        await save(s, request(5, { revision: 1 }));
        await s.operations.ready(uuid(104), ACTOR);
        expect(await s.operations.commit(uuid(104), ACTOR)).toMatchObject({ state: 'conflict' });
    });

    test('rejects a save that breaks a constraint and queues its markdown for cleanup', async () => {
        const s = stores();
        await save(s, request(1));
        const rejected = await save(
            s,
            request(2, { postId: uuid(2), post: { ...request(2).post, slug: 'hello' } })
        );
        expect(rejected).toMatchObject({ state: 'rejected' });
        expect(s.sqlite.query('select storage_path from db_post_storage_cleanup').all()).toEqual([
            { storage_path: markdownPath(2, 102) }
        ]);
        await expect(s.operations.commit(uuid(999), ACTOR)).rejects.toThrow(DataError);
    });

    test('replaces the banner, then deletes the post and retires its banner', async () => {
        const s = stores();
        const replaced = await save(
            s,
            request(1, { banner: { operation: 'replace', sha256: sha, bytes: 1000 } })
        );
        expect(replaced).toMatchObject({
            state: 'committed',
            result: { banner_version: uuid(101) }
        });
        expect(
            s.sqlite.query('select state from db_blog_banner_versions where id = ?').get(uuid(101))
        ).toEqual({ state: 'active' });
        const removed = await save(s, request(2, { kind: 'delete', revision: 1 }));
        expect(removed).toMatchObject({
            state: 'committed',
            result: { id: uuid(1), deleted: true }
        });
        expect(await s.posts.exists(uuid(1))).toBe(false);
        expect(
            s.sqlite.query('select state from db_blog_banner_versions where id = ?').get(uuid(101))
        ).toEqual({ state: 'retired' });
    });

    test('claims retired banners after a day and keeps different markdown from being overwritten', async () => {
        const s = stores();
        s.sqlite.run(
            `INSERT INTO db_blog_banner_versions (id, post_id, object_key, sha256, bytes, state, retired_at)
             VALUES ('${uuid(7)}', '${uuid(8)}', 'blog/banners/${uuid(8)}/${uuid(7)}.webp', '${sha}', 10, 'retired', '2020-01-01T00:00:00.000Z')`
        );
        const claimed = await s.cleanup.claimBanners();
        expect(claimed.map(item => item.id)).toEqual([uuid(7)]);
        await s.cleanup.bannerRemoved(uuid(7));
        expect(await s.cleanup.claimBanners()).toEqual([]);
        await s.operations.writeMarkdown(uuid(1), uuid(2), 'a');
        await s.operations.writeMarkdown(uuid(1), uuid(2), 'a');
        await expect(s.operations.writeMarkdown(uuid(1), uuid(2), 'b')).rejects.toThrow(DataError);
        await s.cleanup.removeMarkdown([markdownPath(1, 2)]);
        expect(s.bucket.objects).toEqual({});
    });
});
