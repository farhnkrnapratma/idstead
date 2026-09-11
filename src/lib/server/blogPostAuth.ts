import type {SupabaseClient} from '@supabase/supabase-js';
import {isSameOriginRequest} from './sameOrigin';

export async function blogAdmin(
  request: Request,
  url: URL,
  db: SupabaseClient
) {
  if (!isSameOriginRequest(request, url))
    return {
      status: 403,
      message: 'Cross-origin requests are not allowed.'
    } as const;
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token)
    return {status: 401, message: 'Admin authentication is required.'} as const;
  const {data, error} = await db.auth.getUser(token);
  if (error || !data.user)
    return {
      status: 401,
      message: 'Your session has expired. Log in again.'
    } as const;
  if (!['admin', 'service_role'].includes(data.user.app_metadata?.role))
    return {status: 403, message: 'Admin privileges are required.'} as const;
  return {actor: data.user.id} as const;
}
