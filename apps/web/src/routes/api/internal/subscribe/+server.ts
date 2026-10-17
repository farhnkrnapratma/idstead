import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { verifyTurnstileToken } from '#lib/server/turnstile.ts';
import { fetchAuthorProfile } from '#lib/author.ts';
import { supabase as publicSupabase } from '#lib/supabase.ts';
import {
    SUBSCRIBER_TABLE,
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

    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'SUBSCRIBE_UNAVAILABLE', 'Subscriptions are not configured.');

    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from)
        return apiError(503, 'SUBSCRIBE_UNAVAILABLE', 'Subscriptions are not configured.');

    const { data: existing } = await db
        .from(SUBSCRIBER_TABLE)
        .select('id, status, confirm_sent_at')
        .eq('email', email)
        .maybeSingle();

    if (existing?.status === 'active') return json(ACCEPTED);

    if (
        existing?.status === 'pending'
        && existing.confirm_sent_at
        && Date.now() - new Date(existing.confirm_sent_at).getTime() < CONFIRM_RESEND_COOLDOWN_MS
    )
        return json(ACCEPTED);

    const salt = ipSalt(platform);

    const confirmToken = createToken();
    const row = {
        email,
        status: 'pending' as const,
        confirm_token_hash: await hashToken(confirmToken),
        confirm_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
        ...(existing?.status === 'unsubscribed' ? { unsubscribe_token: createToken() } : {}),
        ...(salt ? { ip_hash: await hashIp(getClientAddress(), salt) } : {})
    };

    const { error } =
        existing ?
            await db.from(SUBSCRIBER_TABLE).update(row).eq('id', existing.id)
        :   await db.from(SUBSCRIBER_TABLE).insert({ ...row, unsubscribe_token: createToken() });

    if (error) {
        console.error('Failed to record subscriber:', error);
        return apiError(
            503,
            'SUBSCRIBE_UNAVAILABLE',
            'Could not record the subscription right now.'
        );
    }

    const profile = await fetchAuthorProfile(publicSupabase);
    const siteName = profile?.name?.trim() || url.hostname;
    const confirmUrl = `${url.origin}/subscribe/confirm?token=${confirmToken}`;

    const sent = await sendEmail(apiKey, from, {
        to: email,
        ...confirmEmail(siteName, confirmUrl)
    });
    if (!sent) {
        await db
            .from(SUBSCRIBER_TABLE)
            .update({ confirm_sent_at: null })
            .eq('email', email)
            .eq('confirm_token_hash', row.confirm_token_hash);
        return apiError(
            502,
            'SUBSCRIBE_EMAIL_FAILED',
            'The confirmation email could not be sent. Please try again.'
        );
    }

    return json(ACCEPTED);
};
