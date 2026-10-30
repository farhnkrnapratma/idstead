import type { RequestHandler } from './$types';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const service = dataStores(platform).service;
    if (!service) return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, platform);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_POSTS_AUTH_REQUIRED', auth.message);
    try {
        const posts = await service.adminPosts.posts.list();
        return Response.json({ posts }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin post list failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Posts could not be loaded.');
    }
};
