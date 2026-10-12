import { describe, expect, mock, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({
    PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key'
}));

const { cleanupBlogAssets } = await import('../packages/lib/src/server/blogBannerStorage');

describe('queued blog Markdown cleanup', () => {
    test('deletes orphaned post files and keeps files still in use or outside posts/', async () => {
        const livePath =
            'posts/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.md';
        const orphanPaths = [
            'posts/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.md',
            'posts/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.md'
        ];
        const foreignPaths = ['entry.id.md', '../posts/x.md'];
        const removedPaths: string[][] = [];
        const deletedQueuePaths: string[] = [];
        const rows = [livePath, ...orphanPaths, ...foreignPaths].map(storage_path => ({
            storage_path,
            post_id: '11111111-1111-4111-8111-111111111111',
            created_at: new Date(0).toISOString(),
            cleanup_attempts: 0,
            cleanup_error: null
        }));
        const db = {
            rpc: async () => ({ data: [], error: null }),
            from: (table: string) => {
                if (table === 'db_post_storage_cleanup') {
                    return {
                        select: () => ({
                            lt: () => ({ limit: async () => ({ data: rows, error: null }) })
                        }),
                        delete: () => ({
                            eq: async (_column: string, path: string) => {
                                deletedQueuePaths.push(path);
                                return { error: null };
                            }
                        })
                    };
                }
                return {
                    select: () => ({
                        eq: async (_column: string, path: string) => ({
                            count: path === livePath ? 1 : 0,
                            error: null
                        })
                    })
                };
            },
            storage: {
                from: () => ({
                    remove: async (paths: string[]) => {
                        removedPaths.push(paths);
                        return { error: null };
                    }
                })
            }
        } as unknown as SupabaseClient;

        const result = await cleanupBlogAssets(db);

        expect(result).toEqual({ cleanupPending: false, removed: 2 });
        expect(removedPaths).toEqual(orphanPaths.map(path => [path]));
        expect(deletedQueuePaths).toEqual(orphanPaths);
    });
});
