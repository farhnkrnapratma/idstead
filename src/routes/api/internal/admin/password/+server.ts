import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as env from '$app/env/public';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { boundedBody } from '#lib/server/blogPostInput.ts';
import { passwordPolicyError } from '#lib/passwordPolicy.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import {
    checkLoginLockout,
    recordFailedLogin,
    clearLoginAttempts
} from '#lib/server/loginRateLimit.ts';

export const POST: RequestHandler = async ({ request, url, platform, fetch }) => {
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'PASSWORD_UNAVAILABLE', 'Password changes are unavailable.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status) return apiError(auth.status, 'PASSWORD_AUTH_REQUIRED', auth.message);
    const key = `password-change:${auth.actor}`;
    const lockout = checkLoginLockout(key);
    if (!lockout.allowed)
        return apiError(
            429,
            'PASSWORD_RATE_LIMITED',
            'Too many attempts. Try again in 15 minutes.'
        );
    const limiter = platform?.env?.API_RATE_LIMITER;
    if (limiter && !(await limiter.limit({ key })).success)
        return apiError(429, 'PASSWORD_RATE_LIMITED', 'Too many attempts. Try again shortly.');

    let password: string;
    let currentPassword: string;
    try {
        const body = await (await boundedBody(request, 4096)).json();
        if (
            !body
            || typeof body !== 'object'
            || Array.isArray(body)
            || typeof body.password !== 'string'
            || typeof body.currentPassword !== 'string'
            || !body.currentPassword
            || body.currentPassword.length > 1024
        )
            throw new Error();
        password = body.password;
        currentPassword = body.currentPassword;
    } catch {
        return apiError(400, 'PASSWORD_INVALID_INPUT', 'Enter your current and new passwords.');
    }
    const error = passwordPolicyError(password);
    if (error) return apiError(400, 'PASSWORD_INVALID_INPUT', error);
    if (password === currentPassword)
        return apiError(
            400,
            'PASSWORD_UNCHANGED',
            'Choose a password different from your current password.'
        );

    const bindings = platform?.env as Record<string, string> | undefined;
    const authUrl = bindings?.PUBLIC_SUPABASE_URL || env.PUBLIC_SUPABASE_URL;
    const publicKey =
        bindings?.PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!authUrl || !publicKey)
        return apiError(503, 'PASSWORD_UNAVAILABLE', 'Password changes are unavailable.');
    recordFailedLogin(key);
    try {
        const response = await fetch(
            `${authUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')}/auth/v1/user`,
            {
                method: 'PUT',
                headers: {
                    apikey: publicKey,
                    Authorization: `Bearer ${bearerToken(request)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password, current_password: currentPassword }),
                signal: AbortSignal.timeout(15000),
                redirect: 'error'
            }
        );
        if (!response.ok) {
            const result = await response.json();
            const messages: Record<string, string> = {
                current_password_mismatch: 'Your current password is incorrect.',
                current_password_required: 'Enter your current password.',
                same_password: 'Choose a password different from your current password.',
                reauthentication_needed: 'Sign in again before changing your password.',
                insufficient_aal: 'Complete two-factor verification before changing your password.',
                weak_password:
                    'The sign-in service rejected this password. Choose a different passphrase or generate a password.'
            };
            return apiError(
                response.status >= 500 ? 503 : response.status,
                'PASSWORD_UPDATE_FAILED',
                messages[result.code]
                    || 'Password could not be changed. Check your current password or sign in again.'
            );
        }
        clearLoginAttempts(key);
        await logActivity(
            {
                actor: auth.actor,
                action: 'auth.password_update',
                category: 'auth',
                summary: 'Admin changed their password.'
            },
            db
        );
        return json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return apiError(
            503,
            'PASSWORD_UPDATE_UNCONFIRMED',
            'The password change could not be confirmed. Try signing in with your new password before retrying.'
        );
    }
};
