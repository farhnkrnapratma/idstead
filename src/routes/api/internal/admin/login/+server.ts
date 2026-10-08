import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {verifyTurnstileToken} from '#lib/server/turnstile.ts';
import {apiError} from '#lib/server/apiError.ts';
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts
} from '#lib/server/loginRateLimit.ts';
import {isSameOriginRequest} from '#lib/server/sameOrigin.ts';
import * as privateEnv from '$app/env/private';
import {fetchAuthorProfile} from '#lib/author.ts';
import {supabase as publicSupabase} from '#lib/supabase.ts';
import {
  hashIp,
  loginAlertEmail,
  resendApiKey,
  sendEmail,
  senderAddress
} from '#lib/server/subscribers.ts';
import {logActivity} from '#lib/server/activityLog.ts';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';

function ipSalt(platform: unknown): string {
  return (
    (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
    ?? privateEnv.IP_SALT
    ?? ''
  );
}

function getClientIp(getClientAddress: () => string) {
  try {
    return getClientAddress() || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

async function sendLoginAlert(
  to: string,
  request: Request,
  clientIp: string,
  platform: unknown,
  url: URL,
  mfaRequired: boolean
) {
  const apiKey = resendApiKey(platform);
  const from = senderAddress(platform);
  if (!apiKey || !from || !to) return;

  const salt =
    (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
    ?? privateEnv.IP_SALT
    ?? '';

  const profile = await fetchAuthorProfile(publicSupabase);
  await sendEmail(apiKey, from, {
    to,
    ...loginAlertEmail(profile?.name?.trim() || url.hostname, {
      when: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200),
      ipHash:
        salt ? (await hashIp(clientIp, salt)).slice(0, 16) : 'unavailable',
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
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  }

  const clientIp = getClientIp(getClientAddress);
  const salt = ipSalt(platform);
  const activityDb = getSupabaseAdminClient(platform);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const lockout = checkLoginLockout(`ip:${clientIp}`);
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
      activityDb
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
  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';

  if (!email || !password) {
    return apiError(
      400,
      'ADMIN_LOGIN_CREDENTIALS_REQUIRED',
      'email and password are required.'
    );
  }

  const emailKey = `email:${email.toLowerCase()}`;
  const emailLockout = checkLoginLockout(emailKey);
  if (!emailLockout.allowed)
    return apiError(
      429,
      'ADMIN_LOGIN_LOCKED',
      'Too many failed login attempts. Please wait before retrying.',
      `Retry after ${emailLockout.retryAfterSeconds}s.`
    );

  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    clientIp,
    platform
  );
  if (!turnstileOk) {
    recordFailedLogin(`ip:${clientIp}`);
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
      activityDb
    );
    return apiError(
      403,
      'ADMIN_LOGIN_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    );
  }

  const {data, error} = await locals.supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.session) {
    if (error && error.code !== 'invalid_credentials')
      console.error(
        'Admin login rejected by Supabase:',
        error.code,
        error.message
      );
    recordFailedLogin(`ip:${clientIp}`, emailKey);
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
      activityDb
    );
    return apiError(
      401,
      'ADMIN_LOGIN_INVALID_CREDENTIALS',
      'Invalid email or password.'
    );
  }

  clearLoginAttempts(`ip:${clientIp}`, emailKey);
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
    activityDb
  );

  const {data: aal} =
    await locals.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';

  const alert = sendLoginAlert(
    data.user?.email ?? email,
    request,
    clientIp,
    platform,
    url,
    mfaRequired
  ).catch(error => console.error('Login alert failed:', error));
  const context = (
    platform as {context?: {waitUntil?: (p: Promise<unknown>) => void}}
  )?.context;
  context?.waitUntil?.(alert);

  return json(
    {ok: true, mfaRequired},
    {headers: {'Cache-Control': 'no-store'}}
  );
};
