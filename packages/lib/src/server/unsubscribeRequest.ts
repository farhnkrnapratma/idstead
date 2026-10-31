// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubscriberRepository } from '@idstead/data';
import { apiError } from './apiError';
import { isSameOriginRequest } from './sameOrigin';
import { mailingEmailError } from '../mailing';

export async function requestUnsubscribe({
    request,
    url,
    subscribers,
    verify,
    send
}: {
    request: Request;
    url: URL;
    subscribers: SubscriberRepository | null;
    verify: (token: string) => Promise<boolean>;
    send: ((email: string, token: string) => Promise<boolean>) | null;
}) {
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
        return apiError(400, 'UNSUBSCRIBE_INVALID_BODY', 'Invalid JSON body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
        return apiError(
            400,
            'UNSUBSCRIBE_INVALID_BODY',
            'Expected an email address and verification token.'
        );
    const payload = body as { email?: unknown; turnstileToken?: unknown };
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (mailingEmailError(email))
        return apiError(400, 'UNSUBSCRIBE_INVALID_EMAIL', 'Enter a valid email address.');
    if (!(await verify(typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '')))
        return apiError(
            403,
            'UNSUBSCRIBE_TURNSTILE_FAILED',
            'Verification challenge failed. Please try again.'
        );
    if (!subscribers || !send)
        return apiError(503, 'UNSUBSCRIBE_UNAVAILABLE', 'Mailing requests are not configured.');
    try {
        const token = await subscribers.unsubscribeTokenFor(email);
        if (token !== null && (!/^[0-9a-f]{64}$/.test(token) || !(await send(email, token))))
            throw new Error('Confirmation email failed');
        return Response.json({
            ok: true,
            message:
                'If this address has a subscription, check your inbox for a link to confirm unsubscribing.'
        });
    } catch {
        return apiError(
            503,
            'UNSUBSCRIBE_UNAVAILABLE',
            'Could not request an unsubscribe link right now. Please try again.'
        );
    }
}
