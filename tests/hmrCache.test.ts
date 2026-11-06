// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { persistAcrossHmr } from '../packages/lib/src/server/hmrCache.ts';

describe('persistAcrossHmr', () => {
    test('creates the value every time without a hot module', () => {
        let created = 0;
        const make = () => ({ id: ++created });
        expect(persistAcrossHmr(undefined, 'key', make).id).toBe(1);
        expect(persistAcrossHmr(undefined, 'key', make).id).toBe(2);
    });

    test('keeps the first value across reloads of the same hot module', () => {
        const hot = { data: {} as Record<string, unknown> };
        let created = 0;
        const make = () => ({ id: ++created });
        const first = persistAcrossHmr(hot, 'key', make);
        const second = persistAcrossHmr(hot, 'key', make);
        expect(second).toBe(first);
        expect(created).toBe(1);
        expect(hot.data.key).toBe(first);
        expect(persistAcrossHmr(hot, 'other', make).id).toBe(2);
    });
});
