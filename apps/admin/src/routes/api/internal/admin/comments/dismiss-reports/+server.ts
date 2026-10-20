import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { createSupabaseAdminActivityStore } from '@idstead/data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const commentId = typeof body?.commentId === 'string' ? body.commentId.trim() : '';
    if (!commentId) {
        return apiError(400, 'COMMENT_ID_REQUIRED', 'commentId is required.');
    }
    if (!UUID_RE.test(commentId)) {
        return apiError(400, 'COMMENT_ID_INVALID', 'commentId must be a valid UUID.');
    }

    const adminClient = getSupabaseAdminClient(platform);
    if (!adminClient) {
        return apiError(500, 'DATABASE_UNAVAILABLE', 'Database client unavailable.');
    }

    try {
        await createSupabaseAdminActivityStore(adminClient).dismissReports(commentId);
    } catch {
        return apiError(500, 'DISMISS_REPORTS_FAILED', 'Could not dismiss reports.');
    }

    return json({ success: true });
};
