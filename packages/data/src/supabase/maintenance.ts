import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaintenanceStore } from '../maintenance';
import { DataError } from '../errors';

async function prune(db: SupabaseClient, fn: string) {
    const { data, error } = await db.rpc(fn);
    if (error) throw new DataError(fn, error);
    return typeof data === 'number' ? data : 0;
}

export function createSupabaseMaintenanceStore(db: SupabaseClient): MaintenanceStore {
    return {
        pruneStaleSubscriptions: () => prune(db, 'db_prune_stale_subscriptions'),
        pruneActivityLog: () => prune(db, 'db_prune_activity_log'),
        pruneLoginFailures: () => prune(db, 'db_prune_login_failures')
    };
}
