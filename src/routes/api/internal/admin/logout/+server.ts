import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {apiError} from '$lib/server/apiError';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {logActivity} from '$lib/server/activityLog';
import {bearerToken} from '$lib/server/adminAuth';
import {env as privateEnv} from '$env/dynamic/private';

export const POST: RequestHandler = async ({
  request,
  platform,
  url,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');

  const db = getSupabaseAdminClient(platform);
  const token = bearerToken(request);
  let actor: string | null = null;
  if (db && token) {
    const {data} = await db.auth.getUser(token);
    actor = data.user?.email ?? data.user?.id ?? null;
  }

  let ip: string | null;
  try {
    ip = getClientAddress();
  } catch {
    ip = null;
  }

  await logActivity(
    {
      actor,
      action: 'auth.logout',
      category: 'auth',
      summary: 'Admin signed out.',
      ip,
      ipSalt:
        (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
        ?? privateEnv.IP_SALT
        ?? '',
      userAgent: request.headers.get('user-agent') ?? undefined
    },
    db
  );

  return json({ok: true}, {headers: {'Cache-Control': 'no-store'}});
};
