// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';
import type {
    AssetBucket,
    StoredHttpMetadata,
    StoredObject,
    StoredObjectBody
} from '../packages/lib/src/server/r2.ts';

mock.module('cloudflare:workers', () => ({ env: {} }));

const { assetBucket, copyObject, deleteObjects, findAssetBucket, listObjects, readObjectBytes } =
    await import('../packages/lib/src/server/r2.ts');

function memoryBucket(pageSize = 2) {
    const store = new Map<
        string,
        { bytes: Uint8Array<ArrayBuffer>; httpMetadata?: StoredHttpMetadata }
    >();
    const deleteCalls: string[][] = [];
    const meta = (key: string): StoredObject => ({
        key,
        etag: `etag-${key}`,
        httpEtag: `"etag-${key}"`,
        uploaded: new Date(0),
        httpMetadata: store.get(key)?.httpMetadata
    });
    const bucket: AssetBucket = {
        async head(key) {
            return store.has(key) ? meta(key) : null;
        },
        async get(key) {
            const item = store.get(key);
            if (!item) return null;
            return {
                ...meta(key),
                body: new Response(item.bytes).body!,
                arrayBuffer: async () => item.bytes.slice().buffer
            } satisfies StoredObjectBody;
        },
        async put(key, value, options) {
            if (options?.onlyIf?.get('If-None-Match') === '*' && store.has(key)) return null;
            const bytes =
                typeof value === 'string' ? new TextEncoder().encode(value)
                : value instanceof ArrayBuffer ? new Uint8Array(value)
                : new Uint8Array((value as ArrayBufferView<ArrayBuffer>).buffer);
            store.set(key, { bytes, httpMetadata: options?.httpMetadata });
            return meta(key);
        },
        async delete(keys) {
            const list = Array.isArray(keys) ? keys : [keys];
            deleteCalls.push(list);
            for (const key of list) store.delete(key);
        },
        async list(options) {
            const keys = [...store.keys()].filter(key => key.startsWith(options?.prefix ?? ''));
            const start = Number(options?.cursor ?? 0);
            const page = keys.slice(start, start + pageSize);
            const truncated = start + pageSize < keys.length;
            return {
                objects: page.map(meta),
                truncated,
                cursor: truncated ? String(start + pageSize) : undefined
            };
        }
    };
    return { bucket, store, deleteCalls };
}

describe('R2 binding helpers', () => {
    test('find the binding on the platform env and fail clearly without it', async () => {
        const { bucket } = memoryBucket();
        expect(await findAssetBucket({ env: { ASSET_BUCKET: bucket } })).toBe(bucket);
        expect(await findAssetBucket({ env: {} })).toBeNull();
        await expect(assetBucket({ env: {} })).rejects.toThrow('Image storage is not configured.');
    });

    test('copy keeps the bytes and replaces metadata only when asked', async () => {
        const { bucket, store } = memoryBucket();
        await bucket.put('identity/avatar.png', new Uint8Array([1, 2, 3]), {
            httpMetadata: { contentType: 'image/png' }
        });
        await copyObject(bucket, 'identity/avatar.png', 'identity/v1/avatar.png');
        expect(store.get('identity/v1/avatar.png')?.httpMetadata).toEqual({
            contentType: 'image/png'
        });
        await copyObject(bucket, 'identity/v1/avatar.png', 'identity/next.png', {
            contentType: 'image/png',
            cacheControl: 'public, max-age=300'
        });
        expect(await readObjectBytes(bucket, 'identity/next.png')).toEqual(
            new Uint8Array([1, 2, 3])
        );
        expect(store.get('identity/next.png')?.httpMetadata?.cacheControl).toBe(
            'public, max-age=300'
        );
        await expect(copyObject(bucket, 'missing', 'target')).rejects.toThrow('does not exist');
    });

    test('list follows cursors and delete batches by 1000 keys', async () => {
        const { bucket, deleteCalls } = memoryBucket();
        for (const name of ['a', 'b', 'c', 'd', 'e']) await bucket.put(`blog/x/${name}`, name);
        await bucket.put('other/z', 'z');
        const listed = await listObjects(bucket, 'blog/x/');
        expect(listed.map(item => item.key)).toEqual([
            'blog/x/a',
            'blog/x/b',
            'blog/x/c',
            'blog/x/d',
            'blog/x/e'
        ]);
        await deleteObjects(
            bucket,
            Array.from({ length: 2500 }, (_, i) => `k${i}`)
        );
        expect(deleteCalls.map(call => call.length)).toEqual([1000, 1000, 500]);
    });

    test('a create-once put leaves an existing object untouched', async () => {
        const { bucket } = memoryBucket();
        await bucket.put('blog/banners/1.webp', 'first');
        const result = await bucket.put('blog/banners/1.webp', 'second', {
            onlyIf: new Headers({ 'If-None-Match': '*' })
        });
        expect(result).toBeNull();
        expect(
            new TextDecoder().decode((await readObjectBytes(bucket, 'blog/banners/1.webp'))!)
        ).toBe('first');
    });
});
