import { createClient } from '@supabase/supabase-js';
import * as env from '$app/env/public';
import { bearerToken } from './adminAuth';

export function getSupabaseUserClient(request: Request, platform: unknown) {
    const bindings = (platform as { env?: Record<string, string> } | undefined)?.env;
    const token = bearerToken(request);
    const url = bindings?.PUBLIC_SUPABASE_URL || env.PUBLIC_SUPABASE_URL;
    const key = bindings?.PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !token) return null;
    return createClient(url.replace(/\/rest\/v1\/?$/, ''), key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
}
