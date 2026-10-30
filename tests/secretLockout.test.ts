import { describe, expect, test } from 'bun:test';
import {
    checkLockout,
    clearLockout,
    recordLockoutFailure
} from '../packages/lib/src/server/secretLockout.ts';
import type { LockoutStore } from '../packages/data/src/lockout.ts';

function sharedStore(lockoutSeconds = 0) {
    const calls: { op: string; keys: string[] }[] = [];
    const store: LockoutStore = {
        retryAfter: async keys => {
            calls.push({ op: 'retryAfter', keys });
            return lockoutSeconds;
        },
        recordFailure: async keys => {
            calls.push({ op: 'recordFailure', keys });
        },
        clear: async keys => {
            calls.push({ op: 'clear', keys });
        }
    };
    return { calls, store };
}

const offline = async () => {
    throw new Error('database offline');
};
const failingStore: LockoutStore = { retryAfter: offline, recordFailure: offline, clear: offline };

describe('secret lockout', () => {
    test('sends only salted SHA-256 hashes to the shared counter', async () => {
        const { store, calls } = sharedStore();
        await recordLockoutFailure(store, 'salt', 'ip:203.0.113.7', 'client:example-client');
        expect(calls[0].op).toBe('recordFailure');
        expect(calls[0].keys).toHaveLength(2);
        for (const key of calls[0].keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(calls[0].keys.join()).not.toContain('203.0.113.7');
        expect(calls[0].keys.join()).not.toContain('admin@example.com');
    });

    test('uses the wait time returned by the shared counter', async () => {
        expect(await checkLockout(sharedStore(42).store, 'salt', 'ip:203.0.113.8')).toEqual({
            allowed: false,
            retryAfterSeconds: 42
        });
        expect(await checkLockout(sharedStore(0).store, 'salt', 'ip:203.0.113.8')).toEqual({
            allowed: true,
            retryAfterSeconds: 0
        });
    });

    test('falls back to the in-memory counter when the database is unavailable', async () => {
        const key = 'ip:198.51.100.9';
        for (let i = 0; i < 5; i++) await recordLockoutFailure(failingStore, 'salt', key);
        const locked = await checkLockout(null, 'salt', key);
        expect(locked.allowed).toBe(false);
        expect(locked.retryAfterSeconds).toBeGreaterThan(0);
        await clearLockout(failingStore, 'salt', key);
        expect((await checkLockout(null, 'salt', key)).allowed).toBe(true);
    });
});
