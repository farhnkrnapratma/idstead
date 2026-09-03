import {supabase} from '$lib/supabase';
import {json} from '@sveltejs/kit';
import {env as privateEnv} from '$env/dynamic/private';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';

export const POST: RequestHandler = async ({
  request,
  url,
  getClientAddress,
  platform
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  try {
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
    const vote = body?.vote === 'yes' || body?.vote === 'no' ? body.vote : null;

    if (!postId) {
      return apiError(
        400,
        'BLOG_FEEDBACK_POST_ID_REQUIRED',
        'postId is required.'
      );
    }

    if (!vote) {
      return apiError(
        400,
        'BLOG_FEEDBACK_VOTE_INVALID',
        'vote must be "yes" or "no".'
      );
    }

    const ip = getClientAddress();
    const ipSalt =
      (platform as unknown as {env?: {IP_SALT?: string}})?.env?.IP_SALT
      ?? privateEnv.IP_SALT
      ?? process.env.IP_SALT
      ?? 'fkp-feedback-salt';

    const ipHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ip + ipSalt)
    );
    const ipHash = Array.from(new Uint8Array(ipHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const {data, error} = await supabase.rpc('record_post_feedback', {
      p_post_id: postId,
      p_vote: vote,
      p_ip_hash: ipHash
    });

    if (error) {
      console.error('Error recording post feedback:', error);
      return apiError(
        500,
        'BLOG_FEEDBACK_RECORD_FAILED',
        'Could not record feedback in database.'
      );
    }

    return json({recorded: Boolean(data)}, {status: data ? 201 : 200});
  } catch (err) {
    console.error('Feedback recording unexpected error:', err);
    return apiError(
      500,
      'BLOG_FEEDBACK_FAILED',
      'An unexpected error occurred while processing feedback.'
    );
  }
};
