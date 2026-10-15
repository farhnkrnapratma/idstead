import { UUID_PATTERN } from '#lib/blogBanner.ts';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { getBannerObject } from './blogBannerStorage';
import { IMAGE_CACHE_CONTROL } from './profileAssets';
import { PUBLIC_ID_PATTERN, resolvePostUuid } from './postLookup';

export async function serveBlogBanner(
    request: Request,
    file: string,
    platform: App.Platform | undefined
) {
    const match = /^([0-9a-f-]+)\.(webp|avif)$/i.exec(file);
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const postIdParam = match?.[1] ?? '';
    const format = match?.[2]?.toLowerCase() === 'avif' ? 'avif' : 'webp';
    const isPublicId = PUBLIC_ID_PATTERN.test(postIdParam);
    if (!isPublicId && !UUID_PATTERN.test(postIdParam))
        return new Response(null, { status: 404, headers });
    try {
        const db = getSupabaseAdminClient(platform);
        if (!db) return new Response(null, { status: 503, headers });
        const postId = isPublicId ? await resolvePostUuid(db, postIdParam) : postIdParam;
        if (!postId) return new Response(null, { status: 404, headers });
        const { data, error } = await db
            .from('db_posts')
            .select('banner_version')
            .eq('id', postId)
            .maybeSingle();
        if (error) throw error;
        if (!data?.banner_version || !UUID_PATTERN.test(data.banner_version))
            return new Response(null, { status: 404, headers });
        const object = await getBannerObject(platform, postId, data.banner_version, format);
        if (!object) return new Response(null, { status: 404, headers });
        headers.set('Content-Type', format === 'avif' ? 'image/avif' : 'image/webp');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Cache-Control', IMAGE_CACHE_CONTROL);
        if (object.ETag) headers.set('ETag', object.ETag);
        if (
            object.ETag
            && request.headers
                .get('if-none-match')
                ?.split(',')
                .some(tag => tag.trim().replace(/^W\//, '') === object.ETag || tag.trim() === '*')
        )
            return new Response(null, { status: 304, headers });
        if (request.method === 'HEAD') return new Response(null, { headers });
        const body = await object.Body?.transformToByteArray();
        if (!body) throw new Error('Banner body missing.');
        headers.set('Content-Length', String(body.length));
        return new Response(new Uint8Array(body), { headers });
    } catch {
        return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
