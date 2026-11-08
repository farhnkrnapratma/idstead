// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AssetBucket, StoredObject } from '../../packages/lib/src/server/r2.ts';

export function memoryPlatform(keys: string[], uploaded: Record<string, Date> = {}) {
    const store = new Map(keys.map(key => [key, key]));
    const meta = (key: string): StoredObject => ({
        key,
        etag: `etag-${store.get(key)}`,
        httpEtag: `"etag-${store.get(key)}"`,
        uploaded: uploaded[key] ?? new Date()
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
