import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoginLockoutStore } from '../lockout';
import { DataError } from '../errors';

async function call(db: SupabaseClient, fn: string, keys: string[]) {
    const { data, error } = await db.rpc(fn, { p_keys: keys });
    if (error) throw new DataError(fn, error);
    return data as unknown;
}

export function createSupabaseLoginLockoutStore(db: SupabaseClient): LoginLockoutStore {
    return {
        async retryAfter(keys) {
            const seconds = await call(db, 'db_login_lockout', keys);
            if (typeof seconds !== 'number') throw new DataError('db_login_lockout');
            return seconds;
        },

        async recordFailure(keys) {
            await call(db, 'db_login_record_failure', keys);
        },

        async clear(keys) {
            await call(db, 'db_login_clear', keys);
        }
    };
}
