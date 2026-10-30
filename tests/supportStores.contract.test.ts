import { describe, expect, test } from 'bun:test';
import {
    createD1ArdIndexStore,
    createD1IdentityVersionReader,
    createD1LockoutStore,
    createD1MaintenanceStore
} from '../packages/data/src/d1/support.ts';
import { d1Shim, insertRows } from './support/d1.ts';

describe('D1 support stores', () => {
    const key = (char: string) => char.repeat(64);

    test('reads back the ARD index it wrote and the first profile versions', async () => {
        const { db, sqlite } = d1Shim();
        const ard = createD1ArdIndexStore(db);
        expect(await ard.read('https://example.com')).toBeNull();
        await ard.write('https://example.com', [{ id: 'a' }], ['https://example.com/x'], 't1');
        await ard.write('https://example.com', [{ id: 'b' }], [], 't2');
        expect(await ard.read('https://example.com')).toEqual({
            entries: [{ id: 'b' }],
            indexedAt: 't2'
        });
        const identity = createD1IdentityVersionReader(db);
        expect(await identity.current()).toEqual({ avatar: null, banner: null });
        insertRows(sqlite, 'db_identity_versions', [
            { id: 'v1', source: 'custom', avatar_source: 'custom', banner_source: 'custom' }
        ]);
        insertRows(sqlite, 'db_profiles', [
            {
                name: 'Ada',
                username: 'ada',
                headline: 'h',
                job_title: 'j',
                bio: 'b',
                avatar: '',
                email: 'ada@example.com',
                city: 'c',
                postal_code: '1',
                country: 'ID',
                site_url: 'https://example.com',
                avatar_version: 'v1',
                banner_version: 'v1'
            }
        ]);
        expect(await identity.current()).toEqual({ avatar: 'v1', banner: 'v1' });
    });

    test('locks a key after five failures inside the window and clears it', async () => {
        const { db } = d1Shim();
        let clock = Date.parse('2026-10-22T00:00:00.000Z');
        const lockout = createD1LockoutStore(db, () => clock);
        for (let attempt = 0; attempt < 4; attempt++) await lockout.recordFailure([key('a')]);
        expect(await lockout.retryAfter([key('a')])).toBe(0);
        await lockout.recordFailure([key('a'), 'not-a-hash']);
        clock += 60_000;
        expect(await lockout.retryAfter([key('a'), key('b')])).toBe(14 * 60);
        clock += 15 * 60_000;
        expect(await lockout.retryAfter([key('a')])).toBe(0);
        clock -= 15 * 60_000;
        await lockout.clear([key('a')]);
        expect(await lockout.retryAfter([key('a')])).toBe(0);
    });

    test('prunes expired rows and reports how many went', async () => {
        const { db, sqlite } = d1Shim();
        insertRows(sqlite, 'db_lockout_failures', [
            { key_hash: key('a'), failed_at: '2020-01-01T00:00:00.000Z' },
            { key_hash: key('b') }
        ]);
        insertRows(sqlite, 'db_subscribers', [
            {
                email: 'old@example.com',
                unsubscribe_token: 't1',
                created_at: '2020-01-01T00:00:00.000Z'
            },
            { email: 'new@example.com', unsubscribe_token: 't2' }
        ]);
        const maintenance = createD1MaintenanceStore(db);
        expect(await maintenance.pruneLockoutFailures()).toBe(1);
        expect(await maintenance.pruneStaleSubscriptions()).toBe(1);
        expect(await maintenance.pruneActivityLog()).toBe(0);
    });
});
