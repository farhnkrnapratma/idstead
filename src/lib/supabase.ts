/** @format */

import {createClient} from '@supabase/supabase-js'
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY
} from '$env/static/public'
import {env} from '$env/dynamic/public'

const supabaseUrlRaw =
  env.PUBLIC_SUPABASE_URL
  || PUBLIC_SUPABASE_URL
  || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || 'placeholder-key'

if (
  supabaseUrlRaw === 'https://placeholder.supabase.co'
  || supabaseAnonKey === 'placeholder-key'
) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please check your environment variables (.env).'
  )
}

let supabaseUrl = supabaseUrlRaw
if (supabaseUrl.endsWith('/rest/v1') || supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
