// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { oidcEnabled } = await import('../packages/lib/src/server/oidc/enabled.ts');
const { oauthRoute } = await import('../packages/lib/src/server/oidc/route.ts');

describe('OIDC switches', () => {
    test('turns admin sign-in on only for OIDC_ENABLED=1 or true', () => {
        expect(oidcEnabled({ env: { OIDC_ENABLED: '1' } })).toBe(true);
        expect(oidcEnabled({ env: { OIDC_ENABLED: 'TRUE' } })).toBe(true);
        expect(oidcEnabled({ env: { OIDC_ENABLED: '0' } })).toBe(false);
        expect(oidcEnabled({ env: {} })).toBe(false);
    });

    test('pauses token and revoke writes while writes are frozen', async () => {
        const response = await oauthRoute(
            {
                request: new Request('https://example.com/oauth/token', { method: 'POST' }),
                platform: { env: { WRITES_FROZEN: '1' } },
                getClientAddress: () => '203.0.113.9'
            },
            async () => new Response('reached'),
            { writes: true }
        );
        expect(response.status).toBe(503);
        expect(response.headers.get('retry-after')).toBe('60');
        expect((await response.json()).error).toBe('temporarily_unavailable');
    });
});
