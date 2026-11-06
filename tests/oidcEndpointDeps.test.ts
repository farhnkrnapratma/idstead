// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { oidcEndpointDeps } from '../packages/lib/src/server/oidc/deps';
import { d1Shim } from './support/d1';

async function signingKeyJson() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify'
    ]);
    return JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
}

function platform(extra: Record<string, unknown> = {}) {
    const shim = d1Shim();
    return {
        shim,
        platform: { env: { DB: shim.db, PUBLIC_SITE_URL: 'https://example.com', ...extra } }
    };
}

const request = new Request('https://example.com/oauth/token', {
    headers: { 'cf-connecting-ip': '203.0.113.7' }
});

describe('oidcEndpointDeps', () => {
    test('returns nothing without a usable signing key', async () => {
        const { platform: missing } = platform();
        expect(await oidcEndpointDeps(missing, request, () => '')).toBeNull();

        const { platform: broken } = platform({ OIDC_SIGNING_KEY: 'not json' });
        expect(await oidcEndpointDeps(broken, request, () => '')).toBeNull();
    });

    test('wires the stores, issuer and client address when the key is valid', async () => {
        const { platform: ready } = platform({ OIDC_SIGNING_KEY: await signingKeyJson() });
        const deps = await oidcEndpointDeps(ready, request, () => '');
        expect(deps).not.toBeNull();
        expect(deps!.issuer).toBe('https://example.com');
        expect(deps!.ip).toBe('203.0.113.7');
        expect(deps!.clients).toBeDefined();
        expect(deps!.auth).toBeDefined();
        expect(deps!.key).toBeDefined();
    });

    test('counts lockout failures per key and reports the retry delay', async () => {
        const { platform: ready } = platform({ OIDC_SIGNING_KEY: await signingKeyJson() });
        const deps = await oidcEndpointDeps(ready, request, () => '');
        expect(await deps!.lockout.retryAfter(['client-a'])).toBe(0);
        for (let attempt = 0; attempt < 20; attempt++) await deps!.lockout.fail(['client-a']);
        expect(await deps!.lockout.retryAfter(['client-a'])).toBeGreaterThan(0);
    });
});
