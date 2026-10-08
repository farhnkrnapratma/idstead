import {describe, expect, mock, test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({
  PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key'
}));

const {cleanupBlogAssets} = await import('../src/lib/server/blogBannerStorage');

describe('legacy translation Markdown cleanup', () => {
  test('deletes queued translations but preserves an English post still in use', async () => {
    const englishPath =
      'posts/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.md';
    const translationPaths = [
      'entry.id.md',
      'entry.ja.md',
      'entry.zh.md',
      'entry.ko.md'
    ];
    const removedPaths: string[][] = [];
    const deletedQueuePaths: string[] = [];
    const rows = [englishPath, ...translationPaths].map(storage_path => ({
      storage_path,
      post_id: '11111111-1111-4111-8111-111111111111',
      created_at: new Date(0).toISOString(),
      cleanup_attempts: 0,
      cleanup_error: null
    }));
    const db = {
      rpc: async () => ({data: [], error: null}),
      from: (table: string) => {
        if (table === 'db_post_storage_cleanup') {
          return {
            select: () => ({
              lt: () => ({limit: async () => ({data: rows, error: null})})
            }),
            delete: () => ({
              eq: async (_column: string, path: string) => {
                deletedQueuePaths.push(path);
                return {error: null};
              }
            })
          };
        }
        return {
          select: () => ({
            eq: async (_column: string, path: string) => ({
              count: path === englishPath ? 1 : 0,
              error: null
            })
          })
        };
      },
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removedPaths.push(paths);
            return {error: null};
          }
        })
      }
    } as unknown as SupabaseClient;

    const result = await cleanupBlogAssets(db);

    expect(result).toEqual({cleanupPending: false, removed: 4});
    expect(removedPaths).toEqual(translationPaths.map(path => [path]));
    expect(deletedQueuePaths).toEqual(translationPaths);
  });
});
