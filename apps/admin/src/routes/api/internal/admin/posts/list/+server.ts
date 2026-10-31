import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'BLOG_POSTS_UNAVAILABLE',
        message: 'Post storage is not configured.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;
    try {
        const posts = await service.adminPosts.posts.list();
        return Response.json({ posts }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin post list failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Posts could not be loaded.');
    }
};
