// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';
import { createD1OidcAuthStore, createD1OidcClientStore } from '../packages/data/src/d1/oidc.ts';
import { sha256Hex } from '../packages/lib/src/server/oidc/clients.ts';
import { d1Shim } from './support/d1.ts';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { checkAuthorizeRequest, resolveAuthorization } =
    await import('../packages/lib/src/server/oidc/authorize.ts');

const ISSUER = 'https://example.com';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const client = {
    clientId: 'client-confidential-1',
    name: 'Notes',
    redirectUris: ['https://notes.example/callback?tenant=1']
};

function params(overrides: Record<string, string | null> = {}) {
    const values: Record<string, string | null> = {
        client_id: client.clientId,
        redirect_uri: client.redirectUris[0],
        response_type: 'code',
        scope: 'openid profile unknown',
        state: 's-1',
        nonce: 'n-1',
        code_challenge: CHALLENGE,
        code_challenge_method: 'S256',
        ...overrides
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== null) search.set(key, value);
    return search;
}

function stores() {
    const { db } = d1Shim();
    return { clients: createD1OidcClientStore(db), auth: createD1OidcAuthStore(db) };
}

describe('authorize request checks', () => {
    test('never redirects for an unknown app or an unregistered redirect URI', () => {
        expect(checkAuthorizeRequest(params({ client_id: null }), client).kind).toBe('fatal');
        expect(checkAuthorizeRequest(params(), null).kind).toBe('fatal');
        expect(
            checkAuthorizeRequest(
                params({ redirect_uri: 'https://notes.example/callback' }),
                client
            ).kind
        ).toBe('fatal');
        const repeated = params();
        repeated.append('redirect_uri', client.redirectUris[0]);
        expect(checkAuthorizeRequest(repeated, client).kind).toBe('fatal');
    });

    test('sends protocol errors back to the app', () => {
        const cases: Array<[Record<string, string | null>, string]> = [
            [{ response_type: 'token' }, 'unsupported_response_type'],
            [{ scope: 'profile email' }, 'invalid_scope'],
            [{ code_challenge_method: 'plain' }, 'invalid_request'],
            [{ code_challenge_method: null }, 'invalid_request'],
            [{ code_challenge: 'short' }, 'invalid_request'],
            [{ prompt: 'none consent' }, 'invalid_request'],
            [{ prompt: 'bogus' }, 'invalid_request'],
            [{ max_age: '-1' }, 'invalid_request'],
            [{ max_age: '1.5' }, 'invalid_request'],
            [{ request: 'eyJ' }, 'request_not_supported']
        ];
        for (const [overrides, error] of cases) {
            const check = checkAuthorizeRequest(params(overrides), client);
            expect(check).toMatchObject({ kind: 'error', error, state: 's-1' });
        }
    });

    test('keeps only known scopes and passes state and nonce through', () => {
        const check = checkAuthorizeRequest(params(), client);
        expect(check).toEqual({
            kind: 'ok',
            request: {
                clientId: client.clientId,
                redirectUri: client.redirectUris[0],
                scopes: ['openid', 'profile'],
                state: 's-1',
                nonce: 'n-1',
                codeChallenge: CHALLENGE,
                prompt: [],
                maxAge: null
            }
        });
    });
});

describe('authorization decisions', () => {
    test('asks for consent, then issues a single-use code bound to the request', async () => {
        const { clients, auth } = stores();
        await clients.create({ ...client, secretHash: 'a'.repeat(64) });
        const first = await resolveAuthorization({ clients, auth }, params(), {
            issuer: ISSUER,
            authTime: 1_790_000_000
        });
        expect(first).toEqual({
            kind: 'consent',
            client: { name: 'Notes', host: 'notes.example' },
            scopes: [
                expect.objectContaining({ scope: 'openid' }),
                expect.objectContaining({ scope: 'profile' })
            ]
        });

        const allowed = await resolveAuthorization({ clients, auth }, params(), {
            issuer: ISSUER,
            authTime: 1_790_000_000,
            decision: 'allow'
        });
        expect(allowed.kind).toBe('redirect');
        if (allowed.kind !== 'redirect') return;
        expect(allowed.consented).toEqual({ clientId: client.clientId, name: 'Notes' });
        const url = new URL(allowed.url);
        expect(url.origin + url.pathname).toBe('https://notes.example/callback');
        expect(url.searchParams.get('tenant')).toBe('1');
        expect(url.searchParams.get('state')).toBe('s-1');
        expect(url.searchParams.get('iss')).toBe(ISSUER);
        const code = url.searchParams.get('code')!;
        expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);

        const spent = await auth.consumeCode(await sha256Hex(code));
        expect(spent).toMatchObject({
            status: 'ok',
            code: { scopes: ['openid', 'profile'], nonce: 'n-1', authTime: 1_790_000_000 }
        });

        const again = await resolveAuthorization({ clients, auth }, params(), {
            issuer: ISSUER,
            authTime: 1
        });
        expect(again).toMatchObject({ kind: 'redirect', consented: null });
    });

    test('skips consent for granted scopes and honours prompt=none and deny', async () => {
        const { clients, auth } = stores();
        await clients.create({ ...client, secretHash: null });
        const silent = await resolveAuthorization({ clients, auth }, params({ prompt: 'none' }), {
            issuer: ISSUER,
            authTime: 1
        });
        expect(silent.kind === 'redirect' && new URL(silent.url).searchParams.get('error')).toBe(
            'consent_required'
        );

        await auth.grant(client.clientId, ['openid', 'profile', 'email']);
        const quiet = await resolveAuthorization({ clients, auth }, params(), {
            issuer: ISSUER,
            authTime: 1
        });
        expect(quiet.kind === 'redirect' && quiet.consented).toBeNull();
        expect(quiet.kind === 'redirect' && new URL(quiet.url).searchParams.has('code')).toBe(true);

        const forced = await resolveAuthorization(
            { clients, auth },
            params({ prompt: 'consent' }),
            { issuer: ISSUER, authTime: 1 }
        );
        expect(forced.kind).toBe('consent');

        const stale = await resolveAuthorization({ clients, auth }, params({ prompt: 'login' }), {
            issuer: ISSUER,
            authTime: 1_000,
            now: 1_000_000 * 1000
        });
        expect(stale.kind === 'redirect' && new URL(stale.url).searchParams.get('error')).toBe(
            'login_required'
        );
        const fresh = await resolveAuthorization({ clients, auth }, params({ prompt: 'login' }), {
            issuer: ISSUER,
            authTime: 1_000_000 - 60,
            now: 1_000_000 * 1000
        });
        expect(fresh.kind === 'redirect' && new URL(fresh.url).searchParams.has('code')).toBe(true);

        const denied = await resolveAuthorization({ clients, auth }, params(), {
            issuer: ISSUER,
            authTime: 1,
            decision: 'deny'
        });
        expect(denied.kind === 'redirect' && new URL(denied.url).searchParams.get('error')).toBe(
            'access_denied'
        );
    });

    test('answers prompt=none without a session and enforces max_age', async () => {
        const { clients, auth } = stores();
        await clients.create({ ...client, secretHash: null });
        const signedOut = await resolveAuthorization(
            { clients, auth },
            params({ prompt: 'none' }),
            { issuer: ISSUER, authTime: null }
        );
        expect(
            signedOut.kind === 'redirect' && new URL(signedOut.url).searchParams.get('error')
        ).toBe('login_required');
        expect(
            await resolveAuthorization({ clients, auth }, params(), {
                issuer: ISSUER,
                authTime: null
            })
        ).toEqual({ kind: 'login' });
        expect(
            (
                await resolveAuthorization(
                    { clients, auth },
                    params({ client_id: 'unknown-app-00' }),
                    { issuer: ISSUER, authTime: null }
                )
            ).kind
        ).toBe('fatal');

        await auth.grant(client.clientId, ['openid', 'profile']);
        const stale = await resolveAuthorization({ clients, auth }, params({ max_age: '600' }), {
            issuer: ISSUER,
            authTime: 1_000_000 - 601,
            now: 1_000_000 * 1000
        });
        expect(stale.kind === 'redirect' && new URL(stale.url).searchParams.get('error')).toBe(
            'login_required'
        );
        const recent = await resolveAuthorization({ clients, auth }, params({ max_age: '600' }), {
            issuer: ISSUER,
            authTime: 1_000_000 - 60,
            now: 1_000_000 * 1000
        });
        expect(recent.kind === 'redirect' && new URL(recent.url).searchParams.has('code')).toBe(
            true
        );
    });
});
