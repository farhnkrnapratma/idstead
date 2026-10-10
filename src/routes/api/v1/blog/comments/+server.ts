import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { apiError } from '#lib/server/apiError.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ url }) => {
    const postId = url.searchParams.get('postId') || url.searchParams.get('post_id');
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(1, Number.isNaN(limitParam) ? 50 : limitParam), 100);

    if (postId && !UUID_RE.test(postId)) {
        return apiError(
            400,
            'BLOG_COMMENT_INVALID_POST_ID',
            'postId must be a valid UUID.',
            `Received postId '${postId}'.`
        );
    }

    let query = supabase
        .from('db_comments')
        .select(
            'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
        )
        .eq('is_approved', true)
        .order('created_at', { ascending: !!postId })
        .order('id')
        .limit(limit);

    if (postId) {
        query = query.eq('post_id', postId);
    }

    const { data, error: dbErr } = await query;

    if (dbErr) {
        return apiError(500, 'BLOG_COMMENTS_FETCH_FAILED', 'Could not fetch comments.');
    }

    return json(
        { data: data ?? [] },
        { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate' } }
    );
};
