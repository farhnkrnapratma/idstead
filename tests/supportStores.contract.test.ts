import { describe, expect, test } from 'bun:test';
import { createSupabaseArdIndexStore } from '../packages/data/src/supabase/ard.ts';
import { createSupabaseIdentityVersionReader } from '../packages/data/src/supabase/identity.ts';
import { createSupabaseLoginLockoutStore } from '../packages/data/src/supabase/lockout.ts';
import { createSupabaseMaintenanceStore } from '../packages/data/src/supabase/maintenance.ts';
import { DataError } from '../packages/data/src/errors.ts';
import { fakeSupabase, type Row } from './support/fakeSupabase.ts';

describe('Supabase ARD index adapter', () => {
    test('reads nothing for an unknown site, then reads back what it wrote', async () => {
        const store = createSupabaseArdIndexStore(fakeSupabase({ db_ard_index: [] }).db);
        expect(await store.read('https://example.com')).toBeNull();
        await store.write(
            'https://example.com',
            [{ id: 'a' }],
            ['https://example.com/.well-known/ard.json'],
            '2026-10-22T00:00:00Z'
        );
        expect(await store.read('https://example.com')).toEqual({
            entries: [{ id: 'a' }],
            indexedAt: '2026-10-22T00:00:00Z'
        });
        expect(await store.read('https://other.example')).toBeNull();
    });
});

describe('Supabase identity version adapter', () => {
    test('returns the first profile versions', async () => {
        const reader = createSupabaseIdentityVersionReader(
            fakeSupabase({
                db_profiles: [
                    {
                        created_at: '2026-02-01T00:00:00Z',
                        avatar_version: 'later',
                        banner_version: 'later'
                    },
                    {
                        created_at: '2026-01-01T00:00:00Z',
                        avatar_version: 'avatar-v1',
                        banner_version: null
                    }
                ]
            }).db
        );
        expect(await reader.current()).toEqual({ avatar: 'avatar-v1', banner: null });
    });

    test('returns no versions without a profile', async () => {
        const reader = createSupabaseIdentityVersionReader(fakeSupabase({ db_profiles: [] }).db);
        expect(await reader.current()).toEqual({ avatar: null, banner: null });
    });
});

describe('Supabase login lockout adapter', () => {
    function lockoutDb(lockout: unknown, error: Row | null = null) {
        const calls: { fn: string; args: Row }[] = [];
        const handler = (fn: string) => (args: Row) => {
            calls.push({ fn, args });
            return { data: fn === 'db_login_lockout' ? lockout : null, error };
        };
        const { db } = fakeSupabase(
            {},
            {},
            {
                rpc: {
                    db_login_lockout: handler('db_login_lockout'),
                    db_login_record_failure: handler('db_login_record_failure'),
                    db_login_clear: handler('db_login_clear')
                }
            }
        );
        return { calls, store: createSupabaseLoginLockoutStore(db) };
    }

    test('passes the hashed keys to each database function', async () => {
        const { calls, store } = lockoutDb(30);
        expect(await store.retryAfter(['k1'])).toBe(30);
        await store.recordFailure(['k1', 'k2']);
        await store.clear(['k2']);
        expect(calls).toEqual([
            { fn: 'db_login_lockout', args: { p_keys: ['k1'] } },
            { fn: 'db_login_record_failure', args: { p_keys: ['k1', 'k2'] } },
            { fn: 'db_login_clear', args: { p_keys: ['k2'] } }
        ]);
    });

    test('throws a DataError on a failed call or a non-numeric wait', async () => {
        await expect(
            lockoutDb(0, { message: 'offline' }).store.recordFailure(['k'])
        ).rejects.toThrow(DataError);
        await expect(lockoutDb('soon').store.retryAfter(['k'])).rejects.toThrow(DataError);
    });
});

describe('Supabase maintenance adapter', () => {
    test('runs each prune function and returns the removed row count', async () => {
        const calls: string[] = [];
        const prune = (fn: string, removed: unknown) => () => {
            calls.push(fn);
            return { data: removed, error: null };
        };
        const { db } = fakeSupabase(
            {},
            {},
            {
                rpc: {
                    db_prune_stale_subscriptions: prune('db_prune_stale_subscriptions', 2),
                    db_prune_activity_log: prune('db_prune_activity_log', 40),
                    db_prune_login_failures: prune('db_prune_login_failures', null)
                }
            }
        );
        const store = createSupabaseMaintenanceStore(db);
        expect(await store.pruneStaleSubscriptions()).toBe(2);
        expect(await store.pruneActivityLog()).toBe(40);
        expect(await store.pruneLoginFailures()).toBe(0);
        expect(calls).toEqual([
            'db_prune_stale_subscriptions',
            'db_prune_activity_log',
            'db_prune_login_failures'
        ]);
    });

    test('throws a DataError when a prune fails', async () => {
        const { db } = fakeSupabase(
            {},
            {},
            {
                rpc: {
                    db_prune_activity_log: () => ({ data: null, error: { message: 'offline' } })
                }
            }
        );
        await expect(createSupabaseMaintenanceStore(db).pruneActivityLog()).rejects.toThrow(
            DataError
        );
    });
});
