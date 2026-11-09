// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({ IP_SALT: undefined }));

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
