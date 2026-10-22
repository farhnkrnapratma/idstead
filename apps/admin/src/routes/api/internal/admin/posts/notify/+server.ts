import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { notifyNewPost } from '#lib/server/subscriberBroadcast.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    const service = dataStores(platform).service;
    if (!db || !service)
        return apiError(
            503,
            'BLOG_NOTIFY_UNAVAILABLE',
            'Subscriber notifications are not configured.'
        );

    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_NOTIFY_AUTH_REQUIRED', auth.message);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const postId = (body as { postId?: unknown }).postId;
    if (typeof postId !== 'string' || !UUID_RE.test(postId))
        return apiError(400, 'BLOG_NOTIFY_INVALID_POST', 'Invalid post id.');

    const result = await notifyNewPost(
        service.writers.newsletter,
        platform,
        postId,
        (body as { force?: unknown }).force === true
    );

    if (result.reason === 'unavailable')
        return apiError(
            503,
            'BLOG_NOTIFY_UNAVAILABLE',
            'Subscriber notifications are not configured.'
        );
    if (result.reason === 'send-failed')
        return apiError(
            502,
            'BLOG_NOTIFY_SEND_FAILED',
            `Sent to ${result.sent} of ${result.sent + result.failed} subscribers. Try again to reach the rest.`
        );
    if (result.reason === 'unpublished')
        return apiError(
            409,
            'BLOG_NOTIFY_UNPUBLISHED',
            'Publish the post before notifying subscribers.'
        );

    return Response.json(
        { sent: result.sent, reason: result.reason ?? null },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
