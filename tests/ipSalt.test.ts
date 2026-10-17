import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { ipSalt } = await import('../packages/lib/src/server/ipSalt.ts');

describe('ipSalt', () => {
    test('prefers the Worker binding', () => {
        expect(ipSalt({ env: { IP_SALT: 'from-worker' } })).toBe('from-worker');
    });

    test('never falls back to a hard-coded salt', () => {
        const saved = process.env.IP_SALT;
        delete process.env.IP_SALT;
        try {
            expect(ipSalt(undefined)).toBe('');
        } finally {
            if (saved !== undefined) process.env.IP_SALT = saved;
        }
    });
});
