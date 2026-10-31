// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { notifyNewPost } from '#lib/server/subscriberBroadcast.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'BLOG_NOTIFY_UNAVAILABLE',
        message: 'Subscriber notifications are not configured.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

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

    await logAdminActivity(
        request,
        platform,
        {
            action: 'blog.notify',
            category: 'blog',
            entityId: postId,
            summary: `Sent a post to ${result.sent} ${result.sent === 1 ? 'subscriber' : 'subscribers'}.`
        },
        getClientAddress
    );
    return Response.json(
        { sent: result.sent, reason: result.reason ?? null },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
