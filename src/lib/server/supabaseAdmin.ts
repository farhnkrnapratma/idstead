/** @format */

import {createClient} from '@supabase/supabase-js'
import {env as publicEnv} from '$env/dynamic/public'
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY
} from '$env/static/public'

type PlatformEnv = {env?: {SUPABASE_SERVICE_ROLE_KEY?: string}}

function getSupabaseUrl(): string {
  const raw = publicEnv.PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL || ''
  if (raw.endsWith('/rest/v1') || raw.endsWith('/rest/v1/')) {
    return raw.replace(/\/rest\/v1\/?$/, '')
  }
  return raw
}

/**
 * Service-role Supabase client - bypasses RLS entirely. Server-only, never
 * import this from a `.svelte` file or anything bundled for the browser.
 * Used specifically for the moderated comment insert, since RLS no longer
 * grants the public anon/authenticated roles INSERT on `comments` (a direct
 * REST call with only the public anon key could previously insert a
 * pre-approved comment, bypassing Turnstile and moderation entirely).
 * Returns null if SUPABASE_SERVICE_ROLE_KEY isn't configured for this
 * deployment - callers should treat that as "comment submission unavailable"
 * rather than falling back to an insert that RLS will now reject anyway.
 */
export function getSupabaseAdminClient(platform: unknown) {
  const serviceRoleKey =
    (platform as PlatformEnv | undefined)?.env?.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabaseUrl = getSupabaseUrl()
  if (!serviceRoleKey || !supabaseUrl) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {autoRefreshToken: false, persistSession: false}
  })
}
