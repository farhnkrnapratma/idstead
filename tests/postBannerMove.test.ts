import { describe, expect, mock, test } from 'bun:test';
import type { AssetBucket, StoredObject } from '../packages/lib/src/server/r2.ts';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { movePostBanner, syncPostAssets } =
    await import('../packages/lib/src/server/blogPostAssets.ts');

const ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const STAGING = `staging/blog/${ID}`;
const HOME = 'blog/my-post';

function memoryPlatform(keys: string[]) {
    const store = new Map(keys.map(key => [key, key]));
    const meta = (key: string): StoredObject => ({
        key,
        etag: `etag-${store.get(key)}`,
        httpEtag: `"etag-${store.get(key)}"`,
        uploaded: new Date()
    });
    const bucket: AssetBucket = {
        async head(key) {
            return store.has(key) ? meta(key) : null;
        },
        async get(key) {
            const value = store.get(key);
            if (value === undefined) return null;
            const bytes = new TextEncoder().encode(value);
            return {
                ...meta(key),
                body: new Response(bytes).body!,
                arrayBuffer: async () => bytes.buffer
            };
        },
        async put(key, value) {
            store.set(
                key,
                typeof value === 'string' ? value : new TextDecoder().decode(value as ArrayBuffer)
            );
            return meta(key);
        },
        async delete(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
        },
        async list(options) {
            const objects = [...store.keys()]
                .filter(key => key.startsWith(options?.prefix ?? ''))
                .map(meta);
            return { objects, truncated: false };
        }
    };
    return { platform: { env: { ASSET_BUCKET: bucket } } as unknown as App.Platform, store };
}

const draft = { id: ID, slug: 'my-post', published: false, banner_version: VERSION };
const published = { ...draft, published: true };

describe('movePostBanner', () => {
    test('moves the banner into the published folder and leaves Markdown files in place', async () => {
        const { platform, store } = memoryPlatform([
            `${STAGING}/banner.webp`,
            `${STAGING}/banner.avif`,
            `${STAGING}/images/photo.webp`
        ]);
        await movePostBanner({ platform, post: published, previous: draft });
        expect([...store.keys()].sort()).toEqual([
            `${HOME}/banner.avif`,
            `${HOME}/banner.webp`,
            `${STAGING}/images/photo.webp`
        ]);
        expect(store.get(`${HOME}/banner.webp`)).toBe(`${STAGING}/banner.webp`);
    });

    test('moves the banner back to staging when a post is unpublished', async () => {
        const { platform, store } = memoryPlatform([`${HOME}/banner.webp`]);
        await movePostBanner({ platform, post: draft, previous: published });
        expect([...store.keys()]).toEqual([`${STAGING}/banner.webp`]);
    });

    test('does nothing when the folder does not change or the post has no banner', async () => {
        const { platform, store } = memoryPlatform([`${STAGING}/banner.webp`]);
        await movePostBanner({ platform, post: draft, previous: draft });
        await movePostBanner({
            platform,
            post: { ...published, banner_version: null },
            previous: draft
        });
        expect([...store.keys()]).toEqual([`${STAGING}/banner.webp`]);
    });
});

describe('syncPostAssets', () => {
    test('recovers a banner left in staging instead of deleting it', async () => {
        const { platform, store } = memoryPlatform([`${STAGING}/banner.webp`]);
        await syncPostAssets({
            platform,
            cdnBase: '',
            markdown: null,
            post: published,
            previous: published
        });
        expect([...store.keys()]).toEqual([`${HOME}/banner.webp`]);
    });

    test('keeps the published banner over a stale staging copy', async () => {
        const { platform, store } = memoryPlatform([
            `${HOME}/banner.webp`,
            `${STAGING}/banner.webp`
        ]);
        store.set(`${HOME}/banner.webp`, 'current');
        await syncPostAssets({
            platform,
            cdnBase: '',
            markdown: null,
            post: published,
            previous: published
        });
        expect(Object.fromEntries(store)).toEqual({ [`${HOME}/banner.webp`]: 'current' });
    });
});
