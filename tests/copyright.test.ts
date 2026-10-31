// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { copyrightLine } from '../packages/domain/src/copyright.ts';

describe('copyrightLine', () => {
    test('names the site owner when there is one', () => {
        expect(copyrightLine('Ada Lovelace', 2026)).toBe('© 2026 Ada Lovelace.');
    });

    test('falls back to the product name without an owner', () => {
        expect(copyrightLine('', 2026)).toBe('© 2026 Idstead.');
        expect(copyrightLine('   ', 2026)).toBe('© 2026 Idstead.');
        expect(copyrightLine(null, 2026)).toBe('© 2026 Idstead.');
    });
});
