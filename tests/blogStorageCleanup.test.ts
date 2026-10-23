import { describe, expect, mock, test } from 'bun:test';
import type { AdminPostStore, PostCleanupStore } from '../packages/data/src/adminPosts.ts';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({
    PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key'
}));

const { cleanupBlogAssets } = await import('../packages/lib/src/server/blogBannerStorage');

describe('queued blog Markdown cleanup', () => {
    test('deletes orphaned post files with their renders and keeps files still in use or outside posts/', async () => {
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
        const cleanup: PostCleanupStore = {
            claimBanners: async () => [],
            bannerRemoved: async () => {},
            bannerFailed: async () => {},
            pendingMarkdown: async () => rows,
            markdownInUse: async path => path === livePath,
            removeMarkdown: async paths => {
                removedPaths.push(paths);
            },
            markdownRemoved: async path => {
                deletedQueuePaths.push(path);
            },
            markdownFailed: async () => {}
        };
        const posts = { exists: async () => true } as unknown as AdminPostStore;

        const result = await cleanupBlogAssets({ posts, cleanup });

        expect(result).toEqual({ cleanupPending: false, removed: 2 });
        expect(removedPaths).toEqual(
            orphanPaths.map(path => [path, path.replace(/\.md$/, '.render.json')])
        );
        expect(deletedQueuePaths).toEqual(orphanPaths);
    });
});
