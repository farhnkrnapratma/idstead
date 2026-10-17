import { IMAGE_CACHE_CONTROL } from './profileAssets';
import { assetBucket, readObjectBytes } from './r2';
import { bannerKey, sha256 } from '#lib/blogBanner.ts';
import { cleanupOrphanedStaging } from './blogPostAssets';
import type { SupabaseClient } from '@supabase/supabase-js';

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
        httpMetadata: { contentType, cacheControl: IMAGE_CACHE_CONTROL },
        onlyIf: new Headers({ 'If-None-Match': '*' })
    });
    const data = await readObjectBytes(bucket, key);
    if (!data || (await sha256(data)) !== (await sha256(bytes)))
        throw new Error('Stored banner verification failed.');
}

export async function cleanupBlogAssets(db: SupabaseClient, platform?: App.Platform) {
    const { data, error } = await db.rpc('db_claim_blog_banner_cleanup');
    if (error) throw error;
    let failed = false;
    let removed = 0;
    for (const version of data ?? []) {
        try {
            const webpKey = bannerKey(version.post_id, version.id, 'webp');
            const avifKey = bannerKey(version.post_id, version.id, 'avif');
            if (webpKey !== version.object_key && avifKey !== version.object_key)
                throw new Error('Invalid cleanup key.');
            await (await assetBucket(platform)).delete([webpKey, avifKey]);
            const { error: failure } = await db
                .from('db_blog_banner_versions')
                .update({ state: 'deleted', cleanup_error: null })
                .eq('id', version.id)
                .eq('state', 'cleaning');
            if (failure) throw failure;
            removed++;
        } catch {
            failed = true;
            await db
                .from('db_blog_banner_versions')
                .update({ cleanup_error: 'R2 cleanup failed; retry required.' })
                .eq('id', version.id);
        }
    }
    const { data: markdown, error: markdownError } = await db
        .from('db_post_storage_cleanup')
        .select('*')
        .lt('created_at', new Date(Date.now() - 86_400_000).toISOString())
        .limit(20);
    if (markdownError) throw markdownError;
    for (const item of markdown ?? []) {
        try {
            const { count: posts, error: postError } = await db
                .from('db_posts')
                .select('id', { count: 'exact', head: true })
                .eq('storage_path', item.storage_path);
            if (postError) throw new Error('Reference check failed.');
            if (posts) continue;
            if (!/^posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.md$/.test(item.storage_path)) continue;
            const { error: failure } = await db.storage
                .from('blog-posts')
                .remove([item.storage_path]);
            if (failure) throw failure;
            const { error: removeError } = await db
                .from('db_post_storage_cleanup')
                .delete()
                .eq('storage_path', item.storage_path);
            if (removeError) throw removeError;
            removed++;
        } catch {
            failed = true;
            await db
                .from('db_post_storage_cleanup')
                .update({
                    cleanup_attempts: item.cleanup_attempts + 1,
                    cleanup_error: 'Markdown cleanup failed; retry required.'
                })
                .eq('storage_path', item.storage_path);
        }
    }
    try {
        removed += await cleanupOrphanedStaging(platform, async postId => {
            const { count, error: lookupError } = await db
                .from('db_posts')
                .select('id', { count: 'exact', head: true })
                .eq('id', postId);
            if (lookupError) throw lookupError;
            return Boolean(count);
        });
    } catch {
        failed = true;
    }
    return { cleanupPending: failed, removed };
}
