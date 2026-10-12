import type { RequestHandler } from './$types';
import { UUID_PATTERN } from '#lib/blogBanner.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { getBannerObject } from '#lib/server/blogBannerStorage.ts';
import { PUBLIC_ID_PATTERN, resolvePostUuid } from '#lib/server/postLookup.ts';

export const GET: RequestHandler = async ({ request, params, platform }) => {
    const version = params.file.endsWith('.webp') ? params.file.slice(0, -5) : '';
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const isPublicId = PUBLIC_ID_PATTERN.test(params.postId);
    if ((!isPublicId && !UUID_PATTERN.test(params.postId)) || !UUID_PATTERN.test(version))
        return new Response(null, { status: 404, headers });
    try {
        const db = getSupabaseAdminClient(platform);
        if (!db) return new Response(null, { status: 503, headers });
        const postId = isPublicId ? await resolvePostUuid(db, params.postId) : params.postId;
        if (!postId) return new Response(null, { status: 404, headers });
        const { data, error } = await db
            .from('db_blog_banner_versions')
            .select('state')
            .eq('id', version)
            .eq('post_id', postId)
            .maybeSingle();
        if (error) throw error;
        if (!data || !['active', 'retired'].includes(data.state))
            return new Response(null, { status: 404, headers });
        const object = await getBannerObject(platform, postId, version);
        headers.set('Content-Type', 'image/webp');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
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
    } catch (error) {
        return new Response(null, {
            status: error instanceof Error && error.name === 'NoSuchKey' ? 404 : 503,
            headers: { 'Cache-Control': 'no-store' }
        });
    }
};

export const HEAD = GET;
