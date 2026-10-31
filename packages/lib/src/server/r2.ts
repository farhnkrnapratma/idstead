// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { workerBinding } from './workerEnv';

export const ASSET_BUCKET_BINDING = 'ASSET_BUCKET';

export interface StoredHttpMetadata {
    contentType?: string;
    contentDisposition?: string;
    cacheControl?: string;
}

export interface StoredObject {
    key: string;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: StoredHttpMetadata;
}

export interface StoredObjectBody extends StoredObject {
    body: ReadableStream;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export interface AssetBucket {
    head(key: string): Promise<StoredObject | null>;
    get(key: string): Promise<StoredObjectBody | null>;
    put(
        key: string,
        value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
        options?: { httpMetadata?: StoredHttpMetadata; onlyIf?: Headers }
    ): Promise<StoredObject | null>;
    delete(keys: string | string[]): Promise<void>;
    list(options?: {
        prefix?: string;
        cursor?: string;
    }): Promise<{ objects: StoredObject[]; truncated: boolean; cursor?: string }>;
}

const DELETE_BATCH = 1000;

export async function findAssetBucket(platform?: unknown): Promise<AssetBucket | null> {
    const fromPlatform = (platform as { env?: Record<string, unknown> } | undefined)?.env?.[
        ASSET_BUCKET_BINDING
    ];
    return ((fromPlatform ?? (await workerBinding(ASSET_BUCKET_BINDING))) as AssetBucket) ?? null;
}

export async function assetBucket(platform?: unknown): Promise<AssetBucket> {
    const bucket = await findAssetBucket(platform);
    if (!bucket) throw new Error('Image storage is not configured.');
    return bucket;
}

export async function listObjects(bucket: AssetBucket, prefix: string) {
    const objects: StoredObject[] = [];
    let cursor: string | undefined;
    do {
        const page = await bucket.list({ prefix, cursor });
        objects.push(...page.objects);
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return objects;
}

export async function deleteObjects(bucket: AssetBucket, keys: string[]) {
    for (let index = 0; index < keys.length; index += DELETE_BATCH)
        await bucket.delete(keys.slice(index, index + DELETE_BATCH));
}

export async function copyObject(
    bucket: AssetBucket,
    from: string,
    to: string,
    httpMetadata?: StoredHttpMetadata
) {
    const source = await bucket.get(from);
    if (!source) throw new Error(`Stored object ${from} does not exist.`);
    await bucket.put(to, await source.arrayBuffer(), {
        httpMetadata: httpMetadata ?? source.httpMetadata
    });
}

export async function readObjectBytes(bucket: AssetBucket, key: string) {
    const object = await bucket.get(key);
    return object ? new Uint8Array(await object.arrayBuffer()) : null;
}
