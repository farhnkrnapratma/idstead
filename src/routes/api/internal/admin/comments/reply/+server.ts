import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { sanitizeInput } from '#lib/utils/sanitizeInput.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const payload = body as {
        postId?: unknown;
        parentId?: unknown;
        authorName?: unknown;
        content?: unknown;
    };

    const postId = typeof payload?.postId === 'string' ? payload.postId.trim() : '';
    const parentId = typeof payload?.parentId === 'string' ? payload.parentId.trim() : '';
    const authorName =
        typeof payload?.authorName === 'string' && payload.authorName.trim() ?
            sanitizeInput(payload.authorName.trim())
        :   'Administrator';
    const rawContent = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const content = sanitizeInput(rawContent);

    if (!postId || !UUID_RE.test(postId)) {
        return apiError(400, 'BLOG_COMMENT_INVALID_POST_ID', 'postId must be a valid UUID.');
    }
    if (!parentId || !UUID_RE.test(parentId)) {
        return apiError(400, 'BLOG_COMMENT_INVALID_PARENT_ID', 'parentId must be a valid UUID.');
    }
    if (!content) {
        return apiError(400, 'BLOG_COMMENT_CONTENT_REQUIRED', 'content is required.');
    }
    if (content.length > 2000) {
        return apiError(
            400,
            'BLOG_COMMENT_CONTENT_TOO_LONG',
            'content must be 2000 characters or fewer.'
        );
    }

    const adminClient = getSupabaseAdminClient(platform);
    if (!adminClient) {
        return apiError(500, 'DATABASE_UNAVAILABLE', 'Database client unavailable.');
    }

    const { data, error } = await adminClient
        .from('db_comments')
        .insert({
            post_id: postId,
            parent_id: parentId,
            author_name: authorName,
            content,
            is_anonymous: false,
            is_admin: true,
            is_approved: true
        })
        .select(
            'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
        )
        .single();

    if (error) {
        return apiError(500, 'BLOG_COMMENT_SAVE_FAILED', 'Could not save admin reply.');
    }

    return json({ comment: data }, { status: 201 });
};
