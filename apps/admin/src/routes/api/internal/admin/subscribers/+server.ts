// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubscriberStatus } from '@idstead/data';
import type { RequestHandler } from './$types';
import {
    logAdminActivity,
    requireAdminAuth,
    requireSameOriginAdmin
} from '#lib/server/adminRequest.ts';
import { SUBSCRIBER_PAGE_SIZE, sendSubscriberConfirmation } from '#lib/server/adminSubscribers.ts';
import { apiError } from '#lib/server/apiError.ts';
import { dataStores } from '#lib/server/data.ts';
import { isValidEmail, normalizeEmail } from '#lib/server/subscribers.ts';

const STATUSES: SubscriberStatus[] = ['active', 'pending', 'unsubscribed'];

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const denied = await requireAdminAuth(request, platform);
    if (denied) return denied;

    const query = url.searchParams.get('q') ?? '';
    if (query.length > 254)
        return apiError(
            400,
            'SUBSCRIBERS_QUERY_INVALID',
            'Search must be 254 characters or fewer.'
        );
    const status = url.searchParams.get('status') ?? '';
    if (status && !STATUSES.includes(status as SubscriberStatus))
        return apiError(
            400,
            'SUBSCRIBERS_STATUS_INVALID',
            "Status must be 'active', 'pending' or 'unsubscribed'."
        );
    const pageParam = url.searchParams.get('page') ?? '1';
    const page = /^[1-9]\d{0,5}$/.test(pageParam) ? Number(pageParam) : 0;
    if (!page) return apiError(400, 'SUBSCRIBERS_PAGE_INVALID', 'Page must be a positive integer.');

    try {
        const { items, total } = await dataStores(platform).service.adminSubscribers.list({
            query: query || undefined,
            status: (status || undefined) as SubscriberStatus | undefined,
            page,
            limit: SUBSCRIBER_PAGE_SIZE
        });
        return Response.json(
            { items, total, page, pageSize: SUBSCRIBER_PAGE_SIZE },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (error) {
        console.error('Subscriber list failed:', error);
        return apiError(503, 'SUBSCRIBERS_UNAVAILABLE', 'Subscribers are unavailable right now.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email))
        return apiError(400, 'SUBSCRIBER_EMAIL_INVALID', 'Enter a valid email address.');

    const failed = await sendSubscriberConfirmation(
        dataStores(platform).service.writers.subscribers,
        platform,
        email
    );
    if (failed) return failed;

    await logAdminActivity(
        request,
        platform,
        {
            action: 'newsletter.subscriber_add',
            category: 'blog',
            summary: 'Sent a newsletter confirmation to a new subscriber.'
        },
        getClientAddress
    );
    return Response.json({ ok: true }, { status: 202 });
};
