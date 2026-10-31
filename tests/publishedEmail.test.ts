// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { publishedEmail } from '../packages/lib/src/server/publishedEmail.ts';

describe('published email', () => {
    test('returns the profile email only when a contact link publishes it', () => {
        expect(publishedEmail('Ada@Example.com', [{ href: 'mailto:ada@example.com' }])).toBe(
            'ada@example.com'
        );
        expect(
            publishedEmail('ada@example.com', [{ href: 'mailto:ADA%40example.com?subject=Hi' }])
        ).toBe('ada@example.com');
        expect(publishedEmail('ada@example.com', [{ href: 'mailto:other@example.com' }])).toBe('');
        expect(publishedEmail('ada@example.com', [{ href: 'https://example.com/contact' }])).toBe(
            ''
        );
        expect(publishedEmail('ada@example.com', [{ href: 'mailto:%E0%A4%A' }])).toBe('');
        expect(publishedEmail('', [{ href: 'mailto:' }])).toBe('');
        expect(publishedEmail(null, [])).toBe('');
    });
});
