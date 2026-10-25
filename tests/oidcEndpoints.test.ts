import { describe, expect, mock, test } from 'bun:test';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { createD1OidcAuthStore, createD1OidcClientStore } from '../packages/data/src/d1/oidc.ts';
import { sha256Hex } from '../packages/lib/src/server/oidc/clients.ts';
import { d1Shim } from './support/d1.ts';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { parseSigningKey } = await import('../packages/lib/src/server/oidc/keys.ts');
const { resolveAuthorization } = await import('../packages/lib/src/server/oidc/authorize.ts');
const { handleRevoke, handleTokenRequest, handleUserinfo, pkceChallenge } =
    await import('../packages/lib/src/server/oidc/endpoints.ts');
const { generateSigningKey } = await import('../tooling/oidc-key.ts');

const ISSUER = 'https://example.com';
const REDIRECT = 'https://notes.example/callback';
const VERIFIER = 'v'.repeat(43);
const SECRET = 'notes-secret';
const key = (await parseSigningKey(await generateSigningKey()))!;
const jwks = createLocalJWKSet({ keys: [key.publicJwk] });

async function setup() {
    const { db } = d1Shim();
    const clients = createD1OidcClientStore(db);
    const auth = createD1OidcAuthStore(db);
    await clients.create({
        clientId: 'client-confidential-1',
        name: 'Notes',
        redirectUris: [REDIRECT],
        secretHash: await sha256Hex(SECRET)
    });
    await clients.create({
        clientId: 'client-public-00001',
        name: 'Reader',
        redirectUris: [REDIRECT],
        secretHash: null
    });
    const failures = new Map<string, number>();
    const deps = {
        clients,
        auth,
        key,
        issuer: ISSUER,
        ip: '203.0.113.9',
        profile: async () => ({
            name: 'Ada Lovelace',
            username: 'ada',
            email: 'ada@example.com',
            siteUrl: ISSUER,
            avatarVersion: 'v1',
            updatedAt: '2026-10-01T00:00:00.000Z'
        }),
        lockout: {
            retryAfter: async (keys: string[]) =>
                keys.some(k => (failures.get(k) ?? 0) >= 5) ? 60 : 0,
            fail: async (keys: string[]) => {
                for (const k of keys) failures.set(k, (failures.get(k) ?? 0) + 1);
            }
        }
    };
    return { clients, auth, deps };
}

async function authorizeCode(
    deps: Awaited<ReturnType<typeof setup>>['deps'],
    clientId = 'client-confidential-1',
    scope = 'openid profile email offline_access'
) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT,
        response_type: 'code',
        scope,
        state: 's',
        nonce: 'nonce-1',
        code_challenge: await pkceChallenge(VERIFIER),
        code_challenge_method: 'S256'
    });
    const outcome = await resolveAuthorization({ clients: deps.clients, auth: deps.auth }, params, {
        issuer: ISSUER,
        authTime: 1_790_000_000,
        decision: 'allow'
    });
    if (outcome.kind !== 'redirect') throw new Error('no redirect');
    return new URL(outcome.url).searchParams.get('code')!;
}

function form(values: Record<string, string>, headers: Record<string, string> = {}) {
    return new Request(`${ISSUER}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
        body: new URLSearchParams(values)
    });
}

const basic = (id: string, secret: string) => ({
    authorization: `Basic ${btoa(`${id}:${secret}`)}`
});

describe('token endpoint', () => {
    test('exchanges a code for verifiable tokens, then serves userinfo', async () => {
        const { deps } = await setup();
        const code = await authorizeCode(deps);
        const response = await handleTokenRequest(
            form(
                {
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: REDIRECT,
                    code_verifier: VERIFIER
                },
                basic('client-confidential-1', SECRET)
            ),
            deps
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const body = await response.json();
        expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
        expect(body.scope).toBe('openid profile email offline_access');
        expect(typeof body.refresh_token).toBe('string');

        const { payload, protectedHeader } = await jwtVerify(body.id_token, jwks, {
            issuer: ISSUER,
            audience: 'client-confidential-1'
        });
        expect(protectedHeader.kid).toBe(key.kid);
        expect(payload).toMatchObject({
            nonce: 'nonce-1',
            auth_time: 1_790_000_000,
            name: 'Ada Lovelace',
            preferred_username: 'ada',
            picture: `${ISSUER}/avatar.png`,
            email: 'ada@example.com',
            email_verified: false
        });
        expect(payload.sub).toMatch(/^[0-9a-f]{32}$/);

        const info = await handleUserinfo(
            new Request(`${ISSUER}/oauth/userinfo`, {
                headers: { authorization: `Bearer ${body.access_token}` }
            }),
            deps
        );
        expect(info.status).toBe(200);
        expect(await info.json()).toMatchObject({ sub: payload.sub, name: 'Ada Lovelace' });

        const forged = await handleUserinfo(
            new Request(`${ISSUER}/oauth/userinfo`, {
                headers: { authorization: `Bearer ${body.id_token}` }
            }),
            deps
        );
        expect(forged.status).toBe(401);
    });

    test('rejects a wrong verifier, a reused code and a code from another client', async () => {
        const { deps, auth } = await setup();
        const code = await authorizeCode(deps);
        const exchange = (verifier: string) =>
            handleTokenRequest(
                form(
                    {
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: REDIRECT,
                        code_verifier: verifier
                    },
                    basic('client-confidential-1', SECRET)
                ),
                deps
            );
        const wrong = await exchange('w'.repeat(43));
        expect(wrong.status).toBe(400);
        expect((await wrong.json()).error).toBe('invalid_grant');
        expect(await auth.activeGrant('client-confidential-1')).toBeNull();
        expect((await (await exchange(VERIFIER)).json()).error).toBe('invalid_grant');

        const other = await authorizeCode(deps);
        const stolen = await handleTokenRequest(
            form({
                grant_type: 'authorization_code',
                code: other,
                redirect_uri: REDIRECT,
                code_verifier: VERIFIER,
                client_id: 'client-public-00001'
            }),
            deps
        );
        expect((await stolen.json()).error).toBe('invalid_grant');
    });

    test('authenticates clients and locks out repeated failures', async () => {
        const { deps } = await setup();
        const attempt = (headers: Record<string, string>, values: Record<string, string> = {}) =>
            handleTokenRequest(
                form({ grant_type: 'refresh_token', refresh_token: 'x', ...values }, headers),
                deps
            );
        const wrong = await attempt(basic('client-confidential-1', 'nope'));
        expect(wrong.status).toBe(401);
        expect(wrong.headers.get('www-authenticate')).toContain('Basic');
        expect(
            (await attempt({}, { client_id: 'client-public-00001', client_secret: 'x' })).status
        ).toBe(401);
        expect((await attempt({}, { client_id: 'unknown-client-000' })).status).toBe(401);
        expect(
            (await attempt(basic('client-confidential-1', SECRET), { client_secret: SECRET }))
                .status
        ).toBe(400);
        for (let i = 0; i < 3; i++) await attempt(basic('client-confidential-1', 'nope'));
        expect((await attempt(basic('client-confidential-1', SECRET))).status).toBe(429);
        const elsewhere = await handleTokenRequest(
            form(
                { grant_type: 'refresh_token', refresh_token: 'x' },
                basic('client-confidential-1', SECRET)
            ),
            { ...deps, ip: '198.51.100.7' }
        );
        expect((await elsewhere.json()).error).toBe('invalid_grant');
        const notForm = await handleTokenRequest(
            new Request(`${ISSUER}/oauth/token`, { method: 'POST', body: '{}' }),
            deps
        );
        expect((await notForm.json()).error).toBe('invalid_request');
    });

    test('rotates refresh tokens, revokes on reuse and lets clients revoke', async () => {
        const { deps } = await setup();
        const code = await authorizeCode(deps, 'client-public-00001');
        const first = await (
            await handleTokenRequest(
                form({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: REDIRECT,
                    code_verifier: VERIFIER,
                    client_id: 'client-public-00001'
                }),
                deps
            )
        ).json();
        const refresh = (token: string, extra: Record<string, string> = {}) =>
            handleTokenRequest(
                form({
                    grant_type: 'refresh_token',
                    refresh_token: token,
                    client_id: 'client-public-00001',
                    ...extra
                }),
                deps
            );
        const withoutOpenid = await refresh(first.refresh_token, { scope: 'profile' });
        expect((await withoutOpenid.json()).error).toBe('invalid_scope');
        const narrowed = await refresh(first.refresh_token, { scope: 'openid profile' });
        expect(narrowed.status).toBe(200);
        const second = await narrowed.json();
        expect(second.scope).toBe('openid profile');
        expect(second.refresh_token).not.toBe(first.refresh_token);

        const reused = await refresh(first.refresh_token);
        expect((await reused.json()).error).toBe('invalid_grant');
        expect((await (await refresh(second.refresh_token)).json()).error).toBe('invalid_grant');
        const info = await handleUserinfo(
            new Request(`${ISSUER}/oauth/userinfo`, {
                headers: { authorization: `Bearer ${second.access_token}` }
            }),
            deps
        );
        expect(info.status).toBe(401);

        const again = await authorizeCode(deps, 'client-public-00001');
        const third = await (
            await handleTokenRequest(
                form({
                    grant_type: 'authorization_code',
                    code: again,
                    redirect_uri: REDIRECT,
                    code_verifier: VERIFIER,
                    client_id: 'client-public-00001'
                }),
                deps
            )
        ).json();
        const revoked = await handleRevoke(
            new Request(`${ISSUER}/oauth/revoke`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: third.refresh_token,
                    client_id: 'client-public-00001'
                })
            }),
            deps
        );
        expect(revoked.status).toBe(200);
        expect((await (await refresh(third.refresh_token)).json()).error).toBe('invalid_grant');
        const userinfo = (token: string) =>
            handleUserinfo(
                new Request(`${ISSUER}/oauth/userinfo`, {
                    headers: { authorization: `Bearer ${token}` }
                }),
                deps
            );
        expect((await userinfo(third.access_token)).status).toBe(401);

        const fourth = await (
            await handleTokenRequest(
                form({
                    grant_type: 'authorization_code',
                    code: await authorizeCode(deps, 'client-public-00001'),
                    redirect_uri: REDIRECT,
                    code_verifier: VERIFIER,
                    client_id: 'client-public-00001'
                }),
                deps
            )
        ).json();
        expect((await userinfo(fourth.access_token)).status).toBe(200);
        const revokedAccess = await handleRevoke(
            new Request(`${ISSUER}/oauth/revoke`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: fourth.access_token,
                    token_type_hint: 'access_token',
                    client_id: 'client-public-00001'
                })
            }),
            deps
        );
        expect(revokedAccess.status).toBe(200);
        expect((await userinfo(fourth.access_token)).status).toBe(401);
        expect((await (await refresh(fourth.refresh_token)).json()).error).toBe('invalid_grant');

        const unsupported = await handleTokenRequest(
            form({ grant_type: 'password', client_id: 'client-public-00001' }),
            deps
        );
        expect((await unsupported.json()).error).toBe('unsupported_grant_type');
    });
});
