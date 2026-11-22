// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { serviceData } from '#lib/server/repositories.ts';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { verifyTurnstileToken } from '#lib/server/turnstile.ts';
import { hashIp, isValidEmail, normalizeEmail } from '#lib/server/subscribers.ts';
import { requestSubscription } from '#lib/server/subscriptionRequest.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

const ACCEPTED = { ok: true, message: 'Check your inbox to confirm the subscription.' };

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const payload = body as { email?: unknown; turnstileToken?: unknown };
    const email = normalizeEmail(payload.email);
    if (!isValidEmail(email))
        return apiError(400, 'SUBSCRIBE_INVALID_EMAIL', 'Enter a valid email address.');

    const turnstileOk = await verifyTurnstileToken(
        typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '',
        getClientAddress(),
        platform
    );
    if (!turnstileOk)
        return apiError(
            403,
            'SUBSCRIBE_TURNSTILE_FAILED',
            'Verification challenge failed. Please try again.'
        );

    const subscribers = serviceData(platform)?.writers.subscribers;
    if (!subscribers)
        return apiError(503, 'SUBSCRIBE_UNAVAILABLE', 'Subscriptions are not configured.');

    const salt = ipSalt(platform);
    const outcome = await requestSubscription(subscribers, platform, {
        email,
        siteOrigin: url.origin,
        userAgent: request.headers.get('user-agent') ?? '',
        ipHash: salt ? await hashIp(getClientAddress(), salt) : null
    });
    if (outcome === 'unavailable')
        return apiError(503, 'SUBSCRIBE_UNAVAILABLE', 'Subscriptions are not configured.');
    if (outcome === 'record-failed')
        return apiError(
            503,
            'SUBSCRIBE_UNAVAILABLE',
            'Could not record the subscription right now.'
        );
    if (outcome === 'send-failed')
        return apiError(
            502,
            'SUBSCRIBE_EMAIL_FAILED',
            'The confirmation email could not be sent. Please try again.'
        );
    return Response.json(ACCEPTED);
};
