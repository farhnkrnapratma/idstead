import {getSupabaseUserClient} from '$lib/server/supabaseUser';
import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {apiError} from '$lib/server/apiError';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {bearerToken} from '$lib/server/adminAuth';
import {logActivity} from '$lib/server/activityLog';
import {env as privateEnv} from '$env/dynamic/private';

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  const userDb = getSupabaseUserClient(request, platform);
  const db = getSupabaseAdminClient(platform);
  if (!db || !userDb)
    return apiError(
      503,
      'SKILLS_STORAGE_UNAVAILABLE',
      'Database is unavailable.'
    );

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'SKILLS_INVALID_INPUT', 'Invalid JSON body.');
  }
  const {authorId, categories} = body ?? {};
  if (typeof authorId !== 'string' || !Array.isArray(categories))
    return apiError(400, 'SKILLS_INVALID_INPUT', 'Invalid skills data.');

  const {error} = await userDb.rpc('db_save_skills', {
    p_author_id: authorId,
    p_categories: categories
  });
  if (error)
    return apiError(400, 'SKILLS_SAVE_FAILED', error.message || 'Save failed.');

  const token = bearerToken(request);
  const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
  await logActivity(
    {
      actor: actor ?? null,
      action: 'skills.update',
      category: 'skills',
      summary: `Saved ${categories.length} skill categories.`,
      ip: (() => {
        try {
          return getClientAddress();
        } catch {
          return null;
        }
      })(),
      ipSalt:
        (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
        ?? privateEnv.IP_SALT
        ?? '',
      userAgent: request.headers.get('user-agent') ?? undefined
    },
    db
  );

  return json({success: true}, {headers: {'Cache-Control': 'no-store'}});
};
