import {json} from '@sveltejs/kit';
import * as privateEnv from '$app/env/private';
import type {RequestHandler} from './$types';
import {apiError} from '#lib/server/apiError.ts';
import {isSameOriginRequest} from '#lib/server/sameOrigin.ts';
import {verifyTurnstileToken} from '#lib/server/turnstile.ts';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {REPORT_REASON_IDS} from '#lib/reportReasons.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
  }

  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    getClientAddress(),
    platform
  );
  if (!turnstileOk) {
    return apiError(
      403,
      'BLOG_COMMENT_REPORT_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    );
  }

  const commentId =
    typeof body?.commentId === 'string' ? body.commentId.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const details =
    typeof body?.details === 'string' ? body.details.trim().slice(0, 500) : '';

  if (!commentId || !UUID_RE.test(commentId)) {
    return apiError(
      400,
      'BLOG_COMMENT_REPORT_INVALID_COMMENT_ID',
      'commentId must be a valid UUID.'
    );
  }

  if (!reason || !REPORT_REASON_IDS.has(reason)) {
    return apiError(
      400,
      'BLOG_COMMENT_REPORT_INVALID_REASON',
      'A valid report reason is required.'
    );
  }

  const adminClient = getSupabaseAdminClient(platform);
  if (!adminClient) {
    return apiError(
      500,
      'BLOG_COMMENT_REPORT_SERVICE_UNAVAILABLE',
      'Report service is temporarily unavailable.'
    );
  }

  const {data: comment, error: commentErr} = await adminClient
    .from('db_comments')
    .select('id')
    .eq('id', commentId)
    .maybeSingle();

  if (commentErr || !comment) {
    return apiError(
      404,
      'BLOG_COMMENT_REPORT_COMMENT_NOT_FOUND',
      'The specified comment was not found.'
    );
  }

  const ip = getClientAddress();
  const ipSalt =
    (platform as unknown as {env?: {IP_SALT?: string}})?.env?.IP_SALT
    ?? privateEnv.IP_SALT
    ?? process.env.IP_SALT
    ?? 'fkp-reports-salt';

  const ipHashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + ipSalt)
  );
  const ipHash = Array.from(new Uint8Array(ipHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const {error: insertErr} = await adminClient
    .from('db_comment_reports')
    .insert({
      comment_id: commentId,
      reason,
      details: details || null,
      reporter_ip_hash: ipHash
    });

  if (insertErr) {
    return apiError(
      500,
      'BLOG_COMMENT_REPORT_SAVE_FAILED',
      'Could not save report.'
    );
  }

  return json({success: true}, {status: 201});
};
