// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AdminSubscriber, SubscriberRepository } from '@idstead/data';
import { apiError } from './apiError';
import { configuredSiteUrl } from './siteUrl';
import { requestSubscription } from './subscriptionRequest';

export const SUBSCRIBER_PAGE_SIZE = 25;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSubscriberId(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value);
}

export async function sendSubscriberConfirmation(
    subscribers: SubscriberRepository,
    platform: unknown,
    email: string
): Promise<Response | null> {
    let siteOrigin: string;
    try {
        siteOrigin = configuredSiteUrl(platform);
    } catch {
        return apiError(503, 'SUBSCRIBERS_UNAVAILABLE', 'Subscriptions are not configured.');
    }
    const outcome = await requestSubscription(subscribers, platform, {
        email,
        siteOrigin,
        userAgent: '',
        ipHash: null
    });
    if (outcome === 'requested') return null;
    if (outcome === 'already-active')
        return apiError(409, 'SUBSCRIBER_EXISTS', 'This email is already subscribed.');
    if (outcome === 'cooling-down')
        return apiError(
            429,
            'SUBSCRIBER_COOLDOWN',
            'A confirmation email was sent in the last five minutes. Try again later.'
        );
    if (outcome === 'send-failed')
        return apiError(
            502,
            'SUBSCRIBER_EMAIL_FAILED',
            'The confirmation email could not be sent.'
        );
    if (outcome === 'record-failed')
        return apiError(
            503,
            'SUBSCRIBERS_UNAVAILABLE',
            'The subscriber could not be saved right now.'
        );
    return apiError(503, 'SUBSCRIBERS_UNAVAILABLE', 'Subscriptions are not configured.');
}

export function subscriberResponse(subscriber: AdminSubscriber, status = 200) {
    return Response.json({ subscriber }, { status, headers: { 'Cache-Control': 'no-store' } });
}
