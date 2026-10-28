import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import {
    checkLoginLockout,
    recordFailedLogin,
    clearLoginAttempts
} from '#lib/server/loginRateLimit.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import {
    hashIp,
    loginAlertEmail,
    resendApiKey,
    sendEmail,
    senderAddress
} from '#lib/server/subscribers.ts';
import { clientAddress, logActivity } from '#lib/server/activityLog.ts';
import { dataStores } from '#lib/server/data.ts';
import { runInBackground } from '#lib/server/workerEnv.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

async function sendLoginAlert(
    to: string,
    request: Request,
    clientIp: string | null,
    platform: unknown,
    url: URL,
    mfaRequired: boolean
) {
    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from || !to) return;

    const salt = ipSalt(platform);

    const profile = await publicRepositories()
        .author.profile()
        .catch(() => null);
    await sendEmail(apiKey, from, {
        to,
        ...loginAlertEmail(profile?.name?.trim() || url.hostname, {
            when: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200),
            ipHash: salt && clientIp ? (await hashIp(clientIp, salt)).slice(0, 16) : 'unavailable',
            mfa: mfaRequired
        })
    });
}

export const POST: RequestHandler = async ({
    request,
    platform,
    getClientAddress,
    url,
    locals
}) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    }

    const clientIp = clientAddress(getClientAddress);
    const lockoutIp = clientIp ?? '127.0.0.1';
    const salt = ipSalt(platform);
    const service = dataStores(platform).service;
    const lockoutStore = service?.lockout ?? null;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    const lockout = await checkLoginLockout(lockoutStore, salt, `ip:${lockoutIp}`);
    if (!lockout.allowed) {
        await logActivity(
            {
                actor: null,
                action: 'auth.login_locked',
                category: 'security',
                summary: 'Login blocked by IP lockout.',
                ip: clientIp,
                ipSalt: salt,
                userAgent
            },
            service?.activityLog
        );
        return apiError(
            429,
            'ADMIN_LOGIN_LOCKED',
            'Too many failed login attempts. Please wait before retrying.',
            `Retry after ${lockout.retryAfterSeconds}s.`
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const captchaToken = typeof body?.captchaToken === 'string' ? body.captchaToken : '';

    if (!email || !password) {
        return apiError(
            400,
            'ADMIN_LOGIN_CREDENTIALS_REQUIRED',
            'email and password are required.'
        );
    }

    const emailKey = `email-ip:${email.toLowerCase()}|${lockoutIp}`;
    const emailLockout = await checkLoginLockout(lockoutStore, salt, emailKey);
    if (!emailLockout.allowed)
        return apiError(
            429,
            'ADMIN_LOGIN_LOCKED',
            'Too many failed login attempts. Please wait before retrying.',
            `Retry after ${emailLockout.retryAfterSeconds}s.`
        );

    const rejectTurnstile = async () => {
        await recordFailedLogin(lockoutStore, salt, `ip:${lockoutIp}`);
        await logActivity(
            {
                actor: email,
                action: 'auth.login_turnstile_failed',
                category: 'security',
                summary: 'Turnstile verification failed during login.',
                ip: clientIp,
                ipSalt: salt,
                userAgent
            },
            service?.activityLog
        );
        return apiError(403, 'ADMIN_LOGIN_TURNSTILE_FAILED', 'Turnstile verification failed.');
    };

    if (!captchaToken) return rejectTurnstile();

    const { data, error } = await locals.supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken }
    });
    if (error?.code === 'captcha_failed') return rejectTurnstile();

    if (error || !data.session) {
        if (error && error.code !== 'invalid_credentials')
            console.error('Admin login rejected by Supabase:', error.code, error.message);
        await recordFailedLogin(lockoutStore, salt, `ip:${lockoutIp}`, emailKey);
        await logActivity(
            {
                actor: email,
                action: 'auth.login_failed',
                category: 'auth',
                summary: 'Invalid email or password.',
                ip: clientIp,
                ipSalt: salt,
                userAgent
            },
            service?.activityLog
        );
        return apiError(401, 'ADMIN_LOGIN_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    await clearLoginAttempts(lockoutStore, salt, `ip:${lockoutIp}`, emailKey);
    await logActivity(
        {
            actor: data.user?.email ?? email,
            action: 'auth.login',
            category: 'auth',
            summary: 'Admin signed in.',
            ip: clientIp,
            ipSalt: salt,
            userAgent
        },
        service?.activityLog
    );

    const { data: aal } = await locals.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';

    const alert = sendLoginAlert(
        data.user?.email ?? email,
        request,
        clientIp,
        platform,
        url,
        mfaRequired
    ).catch(error => console.error('Login alert failed:', error));
    await runInBackground(alert);

    return Response.json({ ok: true, mfaRequired }, { headers: { 'Cache-Control': 'no-store' } });
};
