import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { UUID_PATTERN } from '#lib/blogBanner.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    const service = dataStores(platform).service;
    if (!db || !service)
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_POSTS_AUTH_REQUIRED', auth.message);
    const id = url.searchParams.get('id')?.toLowerCase() ?? '';
    if (!UUID_PATTERN.test(id)) return apiError(400, 'BLOG_POST_INVALID', 'Invalid post id.');
    let post;
    try {
        post = await service.adminPosts.posts.get(id);
    } catch (error) {
        console.error('Admin post load failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'The post could not be loaded.');
    }
    if (!post) return apiError(404, 'BLOG_POST_NOT_FOUND', 'Post not found.');
    return json({ post }, { headers: { 'Cache-Control': 'no-store' } });
};
