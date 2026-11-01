// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { IMMUTABLE_CACHE_CONTROL } from './profileAssets';
import { assetBucket, readObjectBytes } from './r2';
import { bannerKey, sha256 } from '#lib/blogBanner.ts';
import { cleanupOrphanedStaging } from './blogPostAssets';
import { postRenderPath, type AdminPostStores } from '@idstead/data';

export async function putBanner(
    platform: App.Platform | undefined,
    postId: string,
    version: string,
    bytes: Uint8Array<ArrayBuffer>,
    format: 'webp' | 'avif' = 'webp'
) {
    const bucket = await assetBucket(platform);
    const key = bannerKey(postId, version, format);
    const contentType = format === 'avif' ? 'image/avif' : 'image/webp';
    await bucket.put(key, bytes, {
        httpMetadata: { contentType, cacheControl: IMMUTABLE_CACHE_CONTROL },
        onlyIf: new Headers({ 'If-None-Match': '*' })
    });
    const data = await readObjectBytes(bucket, key);
    if (!data || (await sha256(data)) !== (await sha256(bytes)))
        throw new Error('Stored banner verification failed.');
}

export async function cleanupBlogAssets(
    stores: Pick<AdminPostStores, 'posts' | 'cleanup'>,
    platform?: App.Platform
) {
    const { posts, cleanup } = stores;
    let failed = false;
    let removed = 0;
    for (const version of await cleanup.claimBanners()) {
        try {
            const webpKey = bannerKey(version.post_id, version.id, 'webp');
            const avifKey = bannerKey(version.post_id, version.id, 'avif');
            if (webpKey !== version.object_key && avifKey !== version.object_key)
                throw new Error('Invalid cleanup key.');
            await (await assetBucket(platform)).delete([webpKey, avifKey]);
            await cleanup.bannerRemoved(version.id);
            removed++;
        } catch {
            failed = true;
            await cleanup.bannerFailed(version.id).catch(() => {});
        }
    }
    for (const item of await cleanup.pendingMarkdown(new Date(Date.now() - 86_400_000), 20)) {
        try {
            if (await cleanup.markdownInUse(item.storage_path)) continue;
            if (!/^posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.md$/.test(item.storage_path)) continue;
            const renderPath = postRenderPath(item.storage_path);
            await cleanup.removeMarkdown(
                renderPath ? [item.storage_path, renderPath] : [item.storage_path]
            );
            await cleanup.markdownRemoved(item.storage_path);
            removed++;
        } catch {
            failed = true;
            await cleanup.markdownFailed(item).catch(() => {});
        }
    }
    try {
        removed += await cleanupOrphanedStaging(platform, postId => posts.exists(postId));
    } catch {
        failed = true;
    }
    return { cleanupPending: failed, removed };
}
