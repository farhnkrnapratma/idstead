import {createBrowserClient, isBrowser} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {env as publicEnv} from '$env/dynamic/public';

const supabaseUrlRaw =
  publicEnv.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

let supabaseUrl = supabaseUrlRaw;
if (supabaseUrl.endsWith('/rest/v1') || supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
}

export const supabase =
  isBrowser() ?
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {experimental: {passkey: true}}
    })
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        experimental: {passkey: true}
      }
    });
