import type { SupabaseClient } from '@supabase/supabase-js';
import type { IdentityVersionReader } from '../identity';
import { DataError } from '../errors';

type VersionRow = { avatar_version: string | null; banner_version: string | null };

export function createSupabaseIdentityVersionReader(db: SupabaseClient): IdentityVersionReader {
    return {
        async current() {
            const { data, error } = await db
                .from('db_profiles')
                .select('avatar_version, banner_version')
                .order('created_at')
                .limit(1)
                .maybeSingle();
            if (error) throw new DataError('identity.current', error);
            const row = data as VersionRow | null;
            return { avatar: row?.avatar_version ?? null, banner: row?.banner_version ?? null };
        }
    };
}
