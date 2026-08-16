import {createClient} from '@supabase/supabase-js'
import {env as publicEnv} from '$env/dynamic/public'
import {
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from '$env/static/public'

const supabaseUrlRaw =
  publicEnv.PUBLIC_SUPABASE_URL
  || PUBLIC_SUPABASE_URL
  || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || 'placeholder-key'

let supabaseUrl = supabaseUrlRaw
if (supabaseUrl.endsWith('/rest/v1') || supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
