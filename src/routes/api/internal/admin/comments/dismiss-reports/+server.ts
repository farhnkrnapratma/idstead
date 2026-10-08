import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {requireAdminAuth} from '#lib/server/adminCv.ts';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {isSameOriginRequest} from '#lib/server/sameOrigin.ts';
import {apiError} from '#lib/server/apiError.ts';

export const POST: RequestHandler = async ({request, url, platform}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
  }

  const commentId =
    typeof body?.commentId === 'string' ? body.commentId.trim() : '';
  if (!commentId) {
    return apiError(400, 'COMMENT_ID_REQUIRED', 'commentId is required.');
  }

  const adminClient = getSupabaseAdminClient(platform);
  if (!adminClient) {
    return apiError(
      500,
      'DATABASE_UNAVAILABLE',
      'Database client unavailable.'
    );
  }

  const {error} = await adminClient
    .from('db_comment_reports')
    .delete()
    .eq('comment_id', commentId);

  if (error) {
    return apiError(
      500,
      'DISMISS_REPORTS_FAILED',
      'Could not dismiss reports.'
    );
  }

  return json({success: true});
};
