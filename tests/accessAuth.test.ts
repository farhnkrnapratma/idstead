import { describe, expect, mock, test } from 'bun:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { accessConfig, accessIdentity, DEV_ADMIN_EMAIL, normalizeTeamDomain, verifyAccessToken } =
    await import('../packages/lib/src/server/accessAuth.ts');
const { verifyAdminRequest } = await import('../packages/lib/src/server/adminAuth.ts');

const TEAM = 'team.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const NOW = 1_800_000_000;
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: 'owner@example.com' };

const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const keys = createLocalJWKSet({ keys: [publicJwk] });
const { privateKey: otherKey } = await generateKeyPair('RS256');

function token(
    claims: Record<string, unknown> = {},
    options: { key?: CryptoKey; issuer?: string; audience?: string; expires?: number } = {}
) {
    return new SignJWT({ email: 'Owner@Example.com', type: 'app', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(options.issuer ?? `https://${TEAM}`)
        .setAudience(options.audience ?? AUD)
        .setSubject('user-1')
        .setIssuedAt(NOW - 60)
        .setExpirationTime(options.expires ?? NOW + 3600)
        .sign(options.key ?? privateKey);
}

function request(value?: string, url = 'https://admin.example.com/') {
    return new Request(url, { headers: value ? { 'cf-access-jwt-assertion': value } : {} });
}

describe('Cloudflare Access configuration', () => {
    test('needs a team domain, a 64-hex audience and at least one admin email', () => {
        expect(accessConfig({ env })).toEqual({
            teamDomain: TEAM,
            audience: AUD,
            adminEmails: ['owner@example.com']
        });
        expect(accessConfig({ env: { ...env, ADMIN_EMAILS: ' , ' } })).toBeNull();
        expect(accessConfig({ env: { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } })).toBeNull();
        expect(accessConfig({ env: { ...env, ACCESS_AUD: 'short' } })).toBeNull();
        expect(accessConfig({ env: { ACCESS_AUD: AUD } })).toBeNull();
    });

    test('accepts the team domain as a URL and lowercases admin emails', () => {
        expect(normalizeTeamDomain('https://Team.cloudflareaccess.com/')).toBe(TEAM);
        expect(
            accessConfig({
                env: { ...env, ADMIN_EMAILS: ' Owner@Example.com, second@example.com' }
            })?.adminEmails
        ).toEqual(['owner@example.com', 'second@example.com']);
    });
});

describe('Cloudflare Access token', () => {
    const config = { teamDomain: TEAM, audience: AUD, adminEmails: ['owner@example.com'] };

    test('a valid application token yields the owner identity', async () => {
        expect(await verifyAccessToken(await token(), config, { keys, now: NOW })).toEqual({
            email: 'owner@example.com',
            subject: 'user-1',
            authTime: NOW - 60
        });
    });

    test('rejects the wrong audience, issuer, signer or an expired token', async () => {
        const verify = async (value: string) =>
            verifyAccessToken(value, config, { keys, now: NOW });
        expect(await verify(await token({}, { audience: 'b'.repeat(64) }))).toBeNull();
        expect(
            await verify(await token({}, { issuer: 'https://other.cloudflareaccess.com' }))
        ).toBeNull();
        expect(await verify(await token({}, { key: otherKey }))).toBeNull();
        expect(await verify(await token({}, { expires: NOW - 1 }))).toBeNull();
    });

    test('rejects service tokens and tokens without an email', async () => {
        const verify = async (value: string) =>
            verifyAccessToken(value, config, { keys, now: NOW });
        expect(await verify(await token({ type: 'service' }))).toBeNull();
        expect(await verify(await token({ email: undefined }))).toBeNull();
    });

    test('admits only emails listed in ADMIN_EMAILS', async () => {
        const other = { ...config, adminEmails: ['someone@example.com'] };
        expect(await verifyAccessToken(await token(), config, { keys, now: NOW })).not.toBeNull();
        expect(await verifyAccessToken(await token(), other, { keys, now: NOW })).toBeNull();
    });
});

describe('admin request identity', () => {
    test('reads the Cf-Access-Jwt-Assertion header', async () => {
        const identity = await accessIdentity(request(await token()), { env }, { keys, now: NOW });
        expect(identity?.email).toBe('owner@example.com');
        expect(await accessIdentity(request(), { env }, { keys, now: NOW })).toBeNull();
    });

    test('without Access config only a dev build on a loopback host gets the dev identity', async () => {
        const local = request(undefined, 'http://localhost:5174/');
        expect((await accessIdentity(local, { env: {} }, { dev: true, now: NOW }))?.email).toBe(
            DEV_ADMIN_EMAIL
        );
        expect(await accessIdentity(local, { env: {} }, { dev: false })).toBeNull();
        expect(
            await accessIdentity(
                request(undefined, 'https://admin.example.com/'),
                { env: {} },
                { dev: true }
            )
        ).toBeNull();
        expect(await accessIdentity(local, { env: {} })).toBeNull();
    });

    test('a configured instance never falls back to the dev identity', async () => {
        const local = request(undefined, 'http://localhost:5174/');
        expect(await accessIdentity(local, { env }, { dev: true })).toBeNull();
    });

    test('verifyAdminRequest answers 401 without an identity', async () => {
        expect(await verifyAdminRequest(request(), { env })).toMatchObject({
            status: 401,
            code: 'ADMIN_AUTH_REQUIRED'
        });
    });
});
