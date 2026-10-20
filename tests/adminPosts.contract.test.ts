import { describe, expect, test } from 'bun:test';
import {
    createSupabaseAdminPostStore,
    createSupabasePostCleanupStore,
    createSupabasePostOperationStore
} from '../packages/data/src/supabase/adminPosts.ts';
import { DataError } from '../packages/data/src/errors.ts';
import {
    ADMIN_POST_SEED,
    adminPostContract,
    markdownPath,
    type AdminPostSeed
} from './contracts/adminPosts.contract.ts';
import { fakeSupabase, type Row } from './support/fakeSupabase.ts';

function supabaseFromSeed(
    seed: AdminPostSeed,
    rpc: NonNullable<Parameters<typeof fakeSupabase>[2]>['rpc'] = {}
) {
    const files: Record<string, string> = {};
    const posts = seed.posts.map((post, index) => {
        const storagePath = post.markdown === null ? null : markdownPath(index + 1, index + 1);
        if (storagePath) files[storagePath] = post.markdown!;
        return {
            id: post.id,
            title: post.title,
            slug: post.slug,
            published: post.published,
            pinned: post.pinned,
            excerpt: post.excerpt,
            created_at: post.createdAt,
            updated_at: null,
            storage_path: storagePath,
            banner_version: null,
            post_revision: 1,
            tags: null,
            collaborators: null,
            helpful_yes: 0,
            helpful_no: 0,
            read_time: post.readMinutes,
            view_count: post.views
        };
    });
    const { db } = fakeSupabase(
        {
            db_posts: posts,
            db_comments: seed.posts.flatMap(post =>
                Array.from({ length: post.comments }, (_, n) => ({
                    id: `${post.id}-${n}`,
                    post_id: post.id
                }))
            ),
            db_post_storage_cleanup: seed.pendingMarkdown.map(item => ({
                storage_path: item.path,
                cleanup_attempts: item.attempts,
                cleanup_error: null,
                created_at: item.createdAt
            }))
        },
        files,
        {
            rpc,
            beforeUpdate: (table, row, patch, tables) => {
                if (table !== 'db_posts') return null;
                const next = { ...row, ...patch };
                if (next.published && !String(next.excerpt ?? '').trim())
                    return { code: '23514', message: 'Excerpt is required to publish a post.' };
                if (
                    patch.pinned === true
                    && !row.pinned
                    && tables.db_posts.filter(item => item.pinned).length >= 3
                )
                    return { code: 'P0001', message: 'Maximum of 3 pinned posts allowed' };
                patch.post_revision = Number(row.post_revision) + 1;
                return null;
            }
        }
    );
    return {
        db,
        files,
        posts: createSupabaseAdminPostStore(db),
        operations: createSupabasePostOperationStore(db),
        cleanup: createSupabasePostCleanupStore(db)
    };
}

adminPostContract('Supabase adapter', supabaseFromSeed);

const operation = (state: string) => ({
    id: 'operation',
    state,
    result: state === 'committed' ? { id: 'post' } : null
});

describe('Supabase post operation adapter', () => {
    test('maps a reused operation ID to its own status', async () => {
        const { operations } = supabaseFromSeed(ADMIN_POST_SEED, {
            db_prepare_post_operation: () => ({
                data: null,
                error: { code: '22023', message: 'Operation ID already used' }
            })
        });
        const prepared = await operations.prepare({
            operationId: 'operation',
            actor: 'actor',
            postId: 'post',
            hash: 'hash',
            revision: null,
            kind: 'save',
            post: {},
            banner: { operation: 'replace' }
        });
        expect(prepared).toEqual({ status: 'reused' });
    });

    test('passes the request to the prepare function', async () => {
        let args: Row = {};
        const { operations } = supabaseFromSeed(ADMIN_POST_SEED, {
            db_prepare_post_operation: received => {
                args = received;
                return { data: operation('pending'), error: null };
            }
        });
        const prepared = await operations.prepare({
            operationId: 'operation',
            actor: 'actor',
            postId: 'post',
            hash: 'hash',
            revision: 4,
            kind: 'delete',
            post: { slug: 'x' },
            banner: { operation: 'keep' }
        });
        expect(prepared).toEqual({ status: 'prepared', operation: operation('pending') });
        expect(args).toEqual({
            p_id: 'operation',
            p_actor: 'actor',
            p_post_id: 'post',
            p_hash: 'hash',
            p_revision: 4,
            p_kind: 'delete',
            p_post: { slug: 'x' },
            p_banner: { operation: 'keep' }
        });
    });

    test('accepts a markdown upload retry with identical content only', async () => {
        const { operations, files } = supabaseFromSeed(ADMIN_POST_SEED);
        const path = 'posts/post/operation.md';
        await operations.writeMarkdown('post', 'operation', '# Same');
        expect(files[path]).toBe('# Same');
        await operations.writeMarkdown('post', 'operation', '# Same');
        expect(operations.writeMarkdown('post', 'operation', '# Other')).rejects.toBeInstanceOf(
            DataError
        );
    });

    test('loading a post whose markdown file is missing fails instead of returning it empty', async () => {
        const { posts, files } = supabaseFromSeed(ADMIN_POST_SEED);
        delete files[markdownPath(1, 1)];
        expect(posts.get(ADMIN_POST_SEED.posts[0].id)).rejects.toBeInstanceOf(DataError);
    });
});
