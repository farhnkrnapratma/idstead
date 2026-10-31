import type { RequestHandler } from './$types';
import { logAdminActivity, requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

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
    const service = dataStores(platform).service;
    if (!service) {
        return apiError(500, 'DATABASE_UNAVAILABLE', 'Database client unavailable.');
    }

    try {
        await service.adminActivity.dismissReports(commentId);
    } catch {
        return apiError(500, 'DISMISS_REPORTS_FAILED', 'Could not dismiss reports.');
    }

    await logAdminActivity(
        request,
        platform,
        {
            action: 'blog.reports_dismiss',
            category: 'blog',
            entityId: commentId,
            summary: 'Dismissed the reports on a comment.'
        },
        getClientAddress
    );
    return Response.json({ success: true });
};
