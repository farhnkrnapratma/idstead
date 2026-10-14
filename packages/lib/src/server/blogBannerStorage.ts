import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { assetStorage } from './profileAssets';
import { bannerKey, sha256 } from '#lib/blogBanner.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function putBanner(
    platform: App.Platform | undefined,
    postId: string,
    version: string,
    bytes: Uint8Array<ArrayBuffer>,
    format: 'webp' | 'avif' = 'webp'
) {
    const { client, bucket } = assetStorage(platform);
    const key = bannerKey(postId, version, format);
    const contentType = format === 'avif' ? 'image/avif' : 'image/webp';
    try {
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: bytes,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable',
                IfNoneMatch: '*'
            }),
            { abortSignal: AbortSignal.timeout(30_000) }
        );
    } catch (error) {
        if (
            !(error instanceof Error)
            || !['PreconditionFailed', 'ConditionalRequestConflict'].includes(error.name)
        )
            throw error;
    }
    const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(30_000)
    });
    const data = await stored.Body?.transformToByteArray();
    if (!data || (await sha256(new Uint8Array(data))) !== (await sha256(bytes)))
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
            const { client, bucket } = assetStorage(platform);
            await Promise.all([
                client.send(new DeleteObjectCommand({ Bucket: bucket, Key: webpKey }), {
                    abortSignal: AbortSignal.timeout(30_000)
                }),
                client.send(new DeleteObjectCommand({ Bucket: bucket, Key: avifKey }), {
                    abortSignal: AbortSignal.timeout(30_000)
                })
            ]);
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
    return { cleanupPending: failed, removed };
}

export async function getBannerObject(
    platform: App.Platform | undefined,
    postId: string,
    version: string,
    format: 'webp' | 'avif' = 'webp'
) {
    const { client, bucket } = assetStorage(platform);
    return client.send(
        new GetObjectCommand({ Bucket: bucket, Key: bannerKey(postId, version, format) }),
        { abortSignal: AbortSignal.timeout(30_000) }
    );
}
