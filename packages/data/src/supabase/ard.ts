import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArdIndexStore } from '../ard';
import { DataError } from '../errors';

export function createSupabaseArdIndexStore(db: SupabaseClient): ArdIndexStore {
    return {
        async read(siteUrl) {
            const { data, error } = await db
                .from('db_ard_index')
                .select('entries,indexed_at')
                .eq('site_url', siteUrl)
                .maybeSingle();
            if (error) throw new DataError('ard.read', error);
            if (!data) return null;
            return { entries: data.entries, indexedAt: data.indexed_at };
        },

        async write(siteUrl, entries, sources, indexedAt) {
            const { error } = await db
                .from('db_ard_index')
                .upsert({ site_url: siteUrl, entries, sources, indexed_at: indexedAt });
            if (error) throw new DataError('ard.write', error);
        }
    };
}
