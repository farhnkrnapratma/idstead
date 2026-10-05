import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {env as privateEnv} from '$env/dynamic/private';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {verifyTurnstileToken} from '$lib/server/turnstile';
import {fetchAuthorProfile} from '$lib/author';
import {supabase as publicSupabase} from '$lib/supabase';
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
} from '$lib/server/subscribers';

const CONFIRM_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

const ACCEPTED = {
  ok: true,
  message: 'Check your inbox to confirm the subscription.'
};

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
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

  const payload = body as {email?: unknown; turnstileToken?: unknown};
  const email = normalizeEmail(payload.email);
  if (!isValidEmail(email))
    return apiError(
      400,
      'SUBSCRIBE_INVALID_EMAIL',
      'Enter a valid email address.'
    );

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
  if (!db)
    return apiError(
      503,
      'SUBSCRIBE_UNAVAILABLE',
      'Subscriptions are not configured.'
    );

  const apiKey = resendApiKey(platform);
  const from = senderAddress(platform);
  if (!apiKey || !from)
    return apiError(
      503,
      'SUBSCRIBE_UNAVAILABLE',
      'Subscriptions are not configured.'
    );

  const {data: existing} = await db
    .from(SUBSCRIBER_TABLE)
    .select('id, status, confirm_sent_at')
    .eq('email', email)
    .maybeSingle();

  if (existing?.status === 'active') return json(ACCEPTED);

  if (
    existing?.status === 'pending'
    && existing.confirm_sent_at
    && Date.now() - new Date(existing.confirm_sent_at).getTime()
      < CONFIRM_RESEND_COOLDOWN_MS
  )
    return json(ACCEPTED);

  const ipSalt =
    (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
    ?? privateEnv.IP_SALT
    ?? '';

  const confirmToken = createToken();
  const row = {
    email,
    status: 'pending' as const,
    confirm_token_hash: await hashToken(confirmToken),
    confirm_sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    ...(ipSalt ? {ip_hash: await hashIp(getClientAddress(), ipSalt)} : {})
  };

  const {error} =
    existing ?
      await db.from(SUBSCRIBER_TABLE).update(row).eq('id', existing.id)
    : await db
        .from(SUBSCRIBER_TABLE)
        .insert({...row, unsubscribe_token: createToken()});

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

  await sendEmail(apiKey, from, {
    to: email,
    ...confirmEmail(siteName, confirmUrl)
  });

  return json(ACCEPTED);
};
