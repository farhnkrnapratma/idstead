// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, expect, mock, test } from 'bun:test';

const objects = new Map<string, Uint8Array>();
const state = { corrupt: false, deleted: [] as string[] };

const bucket = {
    put: async (key: string, bytes: Uint8Array) => {
        objects.set(key, state.corrupt ? new Uint8Array([0]) : bytes);
    },
    delete: async (keys: string[]) => {
        state.deleted.push(...keys);
    }
};

const realR2 = await import('../packages/lib/src/server/r2.ts');
const realAssets = await import('../packages/lib/src/server/blogPostAssets.ts');
mock.module('../packages/lib/src/server/r2.ts', () => ({
    ...realR2,
    assetBucket: async () => bucket,
    readObjectBytes: async (_bucket: unknown, key: string) => objects.get(key) ?? null
}));
mock.module('../packages/lib/src/server/blogPostAssets.ts', () => ({
    ...realAssets,
    cleanupOrphanedStaging: async () => 0
}));

const { putBanner, cleanupBlogAssets } =
    await import('../packages/lib/src/server/blogBannerStorage.ts');

import { bannerKey } from '../packages/lib/src/blogBanner.ts';

const POST = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VERSION = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

beforeEach(() => {
    objects.clear();
    state.corrupt = false;
    state.deleted = [];
});

test('stores a banner and verifies the bytes read back', async () => {
    await putBanner(undefined, POST, VERSION, new Uint8Array([1, 2, 3]), 'avif');
    expect(objects.size).toBe(1);
});

test('rejects a banner that does not read back as written', async () => {
    state.corrupt = true;
    await expect(putBanner(undefined, POST, VERSION, new Uint8Array([1, 2, 3]))).rejects.toThrow(
        'Stored banner verification failed.'
    );
});

test('removes banner objects and records the outcome of each cleanup item', async () => {
    const bannerOk = { id: VERSION, post_id: POST, object_key: bannerKey(POST, VERSION, 'webp') };
    const bannerBad = { id: 'bad', post_id: POST, object_key: 'elsewhere/x' };
    const recorded: string[] = [];
    const cleanup = {
        claimBanners: async () => [bannerOk, bannerBad],
        bannerRemoved: async (id: string) => void recorded.push(`removed:${id}`),
        bannerFailed: async (id: string) => void recorded.push(`failed:${id}`),
        pendingMarkdown: async () => [{ storage_path: 'not-a-post.md' }],
        markdownInUse: async () => false,
        removeMarkdown: async () => {},
        markdownRemoved: async () => {},
        markdownFailed: async () => {}
    };
    const result = await cleanupBlogAssets(
        { posts: { exists: async () => true }, cleanup } as never,
        undefined
    );
    expect(result.cleanupPending).toBe(true);
    expect(result.removed).toBe(1);
    expect(recorded).toEqual([`removed:${VERSION}`, 'failed:bad']);
    expect(state.deleted.length).toBe(2);
});

test('skips markdown still in use or outside the post layout and records removal outcomes', async () => {
    const inUse = `posts/${POST}/${VERSION}.md`;
    const removable = `posts/${POST}/7c9e6679-7425-40de-944b-e07fc1f9aaaa.md`;
    const failing = `posts/${POST}/7c9e6679-7425-40de-944b-e07fc1f9bbbb.md`;
    const removed: string[] = [];
    const failed: string[] = [];
    const cleanup = {
        claimBanners: async () => [],
        pendingMarkdown: async () => [
            { storage_path: inUse },
            { storage_path: 'elsewhere.md' },
            { storage_path: removable },
            { storage_path: failing }
        ],
        markdownInUse: async (path: string) => path === inUse,
        removeMarkdown: async (paths: string[]) => {
            if (paths.includes(failing)) throw new Error('r2 down');
        },
        markdownRemoved: async (path: string) => void removed.push(path),
        markdownFailed: async (item: { storage_path: string }) =>
            void failed.push(item.storage_path),
        bannerRemoved: async () => {},
        bannerFailed: async () => {}
    };
    const result = await cleanupBlogAssets(
        { posts: { exists: async () => true }, cleanup } as never,
        undefined
    );
    expect(removed).toEqual([removable]);
    expect(failed).toEqual([failing]);
    expect(result.cleanupPending).toBe(true);
    expect(result.removed).toBe(1);
});
