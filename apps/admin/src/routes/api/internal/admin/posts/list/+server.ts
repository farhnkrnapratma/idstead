import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { createSupabaseAdminPostStore } from '@idstead/data';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_POSTS_AUTH_REQUIRED', auth.message);
    try {
        const posts = await createSupabaseAdminPostStore(db).list();
        return json({ posts }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin post list failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Posts could not be loaded.');
    }
};
