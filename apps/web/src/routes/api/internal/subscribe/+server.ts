import { publicRepositories, serviceData } from '#lib/server/repositories.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { verifyTurnstileToken } from '#lib/server/turnstile.ts';
import {
    confirmEmail,
    createToken,
    hashIp,
    hashToken,
    isValidEmail,
    normalizeEmail,
    resendApiKey,
    sendEmail,
    senderAddress
} from '#lib/server/subscribers.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

const CONFIRM_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

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

    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from)
        return apiError(503, 'SUBSCRIBE_UNAVAILABLE', 'Subscriptions are not configured.');

    const salt = ipSalt(platform);
    const confirmToken = createToken();
    const confirmTokenHash = await hashToken(confirmToken);

    let result;
    try {
        result = await subscribers.request({
            email,
            confirmTokenHash,
            unsubscribeToken: createToken(),
            userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
            ipHash: salt ? await hashIp(getClientAddress(), salt) : null,
            resendCooldownMs: CONFIRM_RESEND_COOLDOWN_MS
        });
    } catch (error) {
        console.error('Failed to record subscriber:', error);
        return apiError(
            503,
            'SUBSCRIBE_UNAVAILABLE',
            'Could not record the subscription right now.'
        );
    }
    if (result !== 'requested') return json(ACCEPTED);

    const profile = await publicRepositories()
        .author.profile()
        .catch(() => null);
    const siteName = profile?.name?.trim() || url.hostname;
    const confirmUrl = `${url.origin}/subscribe/confirm?token=${confirmToken}`;

    const sent = await sendEmail(apiKey, from, {
        to: email,
        ...confirmEmail(siteName, confirmUrl)
    });
    if (!sent) {
        await subscribers.cancelConfirmation(email, confirmTokenHash).catch(error => {
            console.error('Failed to reset the confirmation cooldown:', error);
        });
        return apiError(
            502,
            'SUBSCRIBE_EMAIL_FAILED',
            'The confirmation email could not be sent. Please try again.'
        );
    }

    return json(ACCEPTED);
};
