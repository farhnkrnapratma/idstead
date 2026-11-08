// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { readPublicWrite } from '../packages/lib/src/server/publicWrite.ts';

const url = new URL('https://example.com/api/internal/contact');

function event(init: RequestInit = {}) {
    return {
        request: new Request(url, { method: 'POST', ...init }),
        url,
        platform: {},
        getClientAddress: () => '203.0.113.5'
    };
}

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin', origin: 'https://example.com' };

describe('public write guards', () => {
    test('refuses cross-origin writes before reading the body', async () => {
        const result = await readPublicWrite(
            event({
                headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
                body: '{}'
            }),
            'CONTACT_TURNSTILE_FAILED'
        );
        expect((result.response as Response).status).toBe(403);
    });

    test('rejects bodies that are not JSON', async () => {
        const result = await readPublicWrite(
            event({ headers: SAME_ORIGIN, body: 'not json' }),
            'CONTACT_TURNSTILE_FAILED'
        );
        expect((result.response as Response).status).toBe(400);
        expect(await (result.response as Response).json()).toMatchObject({
            code: 'INVALID_JSON_BODY'
        });
    });

    test('rejects writes whose Turnstile token is missing or unverifiable', async () => {
        const missing = await readPublicWrite(
            event({
                headers: { ...SAME_ORIGIN, 'content-type': 'application/json' },
                body: JSON.stringify({})
            }),
            'CONTACT_TURNSTILE_FAILED'
        );
        expect(await (missing.response as Response).json()).toMatchObject({
            code: 'CONTACT_TURNSTILE_FAILED'
        });
        const realFetch = globalThis.fetch;
        globalThis.fetch = (async () =>
            Response.json({ success: false })) as unknown as typeof fetch;
        try {
            const unverified = await readPublicWrite(
                {
                    ...event({
                        headers: { ...SAME_ORIGIN, 'content-type': 'application/json' },
                        body: JSON.stringify({ turnstileToken: 'token' })
                    }),
                    platform: { env: { TURNSTILE_SECRET: 'secret' } }
                },
                'CONTACT_TURNSTILE_FAILED'
            );
            expect((unverified.response as Response).status).toBe(403);
        } finally {
            globalThis.fetch = realFetch;
        }
    });
});
