import {createClient} from '@supabase/supabase-js';
import {env as privateEnv} from '$env/dynamic/private';
import {env as publicEnv} from '$env/dynamic/public';

type PlatformEnv = {
  env?: {SUPABASE_SERVICE_ROLE_KEY?: string; PUBLIC_SUPABASE_URL?: string};
};

function getSupabaseUrl(platform: unknown): string {
  const url =
    (platform as PlatformEnv | undefined)?.env?.PUBLIC_SUPABASE_URL
    || publicEnv.PUBLIC_SUPABASE_URL
    || process.env.PUBLIC_SUPABASE_URL
    || '';

  if (url.endsWith('/rest/v1') || url.endsWith('/rest/v1/')) {
    return url.replace(/\/rest\/v1\/?$/, '');
  }
  return url;
}

export function getSupabaseAdminClient(platform: unknown) {
  const serviceRoleKey =
    (platform as PlatformEnv | undefined)?.env?.SUPABASE_SERVICE_ROLE_KEY
    ?? privateEnv.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl = getSupabaseUrl(platform);
  if (!serviceRoleKey || !supabaseUrl) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {autoRefreshToken: false, persistSession: false}
  });
}
