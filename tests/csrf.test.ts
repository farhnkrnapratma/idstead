// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { isForbiddenCrossSiteForm } from '../packages/lib/src/server/csrf.ts';

function post(path: string, headers: Record<string, string> = {}, method = 'POST') {
    const url = new URL(path, 'https://example.com');
    return [new Request(url, { method, headers, body: 'a=1' }), url] as const;
}

const form = { 'content-type': 'application/x-www-form-urlencoded' };

describe('cross-site form check', () => {
    test('blocks form posts from other origins or without an origin', () => {
        expect(isForbiddenCrossSiteForm(...post('/unsubscribe', form))).toBe(true);
        expect(
            isForbiddenCrossSiteForm(
                ...post('/unsubscribe', { ...form, origin: 'https://evil.example' })
            )
        ).toBe(true);
        expect(
            isForbiddenCrossSiteForm(...post('/unsubscribe', { origin: 'https://evil.example' }))
        ).toBe(true);
        expect(
            isForbiddenCrossSiteForm(
                ...post('/unsubscribe', {
                    'content-type': 'text/plain',
                    origin: 'https://evil.example'
                })
            )
        ).toBe(true);
    });

    test('allows same-origin forms, JSON bodies and reads', () => {
        expect(
            isForbiddenCrossSiteForm(
                ...post('/unsubscribe', { ...form, origin: 'https://example.com' })
            )
        ).toBe(false);
        expect(
            isForbiddenCrossSiteForm(
                ...post('/api/internal/contact', {
                    'content-type': 'application/json',
                    origin: 'https://evil.example'
                })
            )
        ).toBe(false);
        const url = new URL('https://example.com/unsubscribe');
        expect(isForbiddenCrossSiteForm(new Request(url), url)).toBe(false);
    });

    test('lets OAuth clients post to the token, revoke and userinfo endpoints', () => {
        for (const path of ['/oauth/token', '/oauth/revoke', '/oauth/userinfo'])
            expect(isForbiddenCrossSiteForm(...post(path, form))).toBe(false);
        expect(isForbiddenCrossSiteForm(...post('/oauth/authorize', form))).toBe(true);
    });
});
