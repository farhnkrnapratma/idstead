import { describe, expect, test } from 'bun:test';
import {
    checkLoginLockout,
    clearLoginAttempts,
    recordFailedLogin
} from '../packages/lib/src/server/loginRateLimit.ts';

function sharedDb(lockoutSeconds = 0) {
    const calls: { fn: string; keys: string[] }[] = [];
    return {
        calls,
        db: {
            rpc: async (fn: string, args: Record<string, unknown>) => {
                calls.push({ fn, keys: args.p_keys as string[] });
                return { data: fn === 'db_login_lockout' ? lockoutSeconds : null, error: null };
            }
        }
    };
}

const failingDb = { rpc: async () => ({ data: null, error: new Error('database offline') }) };

describe('login lockout', () => {
    test('sends only salted SHA-256 hashes to the shared counter', async () => {
        const { db, calls } = sharedDb();
        await recordFailedLogin(db, 'salt', 'ip:203.0.113.7', 'email:admin@example.com');
        expect(calls[0].fn).toBe('db_login_record_failure');
        expect(calls[0].keys).toHaveLength(2);
        for (const key of calls[0].keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(calls[0].keys.join()).not.toContain('203.0.113.7');
        expect(calls[0].keys.join()).not.toContain('admin@example.com');
    });

    test('uses the wait time returned by the shared counter', async () => {
        expect(await checkLoginLockout(sharedDb(42).db, 'salt', 'ip:203.0.113.8')).toEqual({
            allowed: false,
            retryAfterSeconds: 42
        });
        expect(await checkLoginLockout(sharedDb(0).db, 'salt', 'ip:203.0.113.8')).toEqual({
            allowed: true,
            retryAfterSeconds: 0
        });
    });

    test('falls back to the in-memory counter when the database is unavailable', async () => {
        const key = 'ip:198.51.100.9';
        for (let i = 0; i < 5; i++) await recordFailedLogin(failingDb, 'salt', key);
        const locked = await checkLoginLockout(null, 'salt', key);
        expect(locked.allowed).toBe(false);
        expect(locked.retryAfterSeconds).toBeGreaterThan(0);
        await clearLoginAttempts(failingDb, 'salt', key);
        expect((await checkLoginLockout(null, 'salt', key)).allowed).toBe(true);
    });
});
