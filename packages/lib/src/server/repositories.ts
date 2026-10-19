import { createSupabaseRepositories, type Repositories } from '@fkp/data';
import { supabase } from '#lib/supabase.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';

export function publicRepositories(fetchFn: typeof fetch = fetch): Repositories {
    return createSupabaseRepositories(supabase, { fetch: fetchFn, cdnBase: cdnBaseUrl() });
}
