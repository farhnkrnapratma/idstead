import { json } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError } from './apiError';
import { isSameOriginRequest } from './sameOrigin';
import { mailingEmailError } from '../mailing';

export async function requestUnsubscribe({
    request,
    url,
    db,
    verify,
    send
}: {
    request: Request;
    url: URL;
    db: SupabaseClient | null;
    verify: (token: string) => Promise<boolean>;
    send: ((email: string, token: string) => Promise<boolean>) | null;
}) {
    if (!isSameOriginRequest(request, url))
        return apiError(
            403,
            'UNSUBSCRIBE_FORBIDDEN_ORIGIN',
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
    if (!db || !send)
        return apiError(503, 'UNSUBSCRIBE_UNAVAILABLE', 'Mailing requests are not configured.');
    try {
        const { data, error } = await db
            .from('db_subscribers')
            .select('status, unsubscribe_token')
            .eq('email', email)
            .maybeSingle();
        if (error) throw new Error('Subscriber lookup failed');
        if (data && data.status !== 'unsubscribed') {
            if (
                !/^[0-9a-f]{64}$/.test(data.unsubscribe_token ?? '')
                || !(await send(email, data.unsubscribe_token))
            )
                throw new Error('Confirmation email failed');
        }
        return json({
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
