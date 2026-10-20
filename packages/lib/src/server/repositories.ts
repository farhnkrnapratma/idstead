import {
    createSupabaseRepositories,
    createSupabaseWriters,
    type Repositories,
    type Writers
} from '@idstead/data';
import { supabase } from '#lib/supabase.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { getSupabaseAdminClient } from './supabaseAdmin';

export function publicRepositories(fetchFn: typeof fetch = fetch): Repositories {
    return createSupabaseRepositories(supabase, { fetch: fetchFn, cdnBase: cdnBaseUrl() });
}

export function serviceData(platform?: unknown): (Repositories & { writers: Writers }) | null {
    const db = getSupabaseAdminClient(platform);
    if (!db) return null;
    return { ...createSupabaseRepositories(db), writers: createSupabaseWriters(db) };
}
