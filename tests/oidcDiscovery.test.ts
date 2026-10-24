import { describe, expect, mock, test } from 'bun:test';
import { jwtVerify, SignJWT, createLocalJWKSet } from 'jose';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { parseSigningKey, OIDC_ALG } = await import('../packages/lib/src/server/oidc/keys.ts');
const { discoveryDocument, oidcEndpoints } =
    await import('../packages/lib/src/server/oidc/config.ts');
const { webfingerDocument, matchesResource, WEBFINGER_RELS } =
    await import('../packages/lib/src/server/oidc/webfinger.ts');
const { generateSigningKey } = await import('../tooling/oidc-key.ts');

const platform = {
    env: { PUBLIC_SITE_URL: 'https://example.com/', PUBLIC_ADMIN_URL: 'https://admin.example.com' }
};

describe('signing key', () => {
    test('parses a generated key and publishes only its public half', async () => {
        const key = await parseSigningKey(await generateSigningKey());
        expect(key).not.toBeNull();
        expect(key!.publicJwk).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' });
        expect(key!.publicJwk).not.toHaveProperty('d');
        expect(key!.kid).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(key!.publicJwk.kid).toBe(key!.kid);
    });

    test('signs tokens that verify against the published key set', async () => {
        const key = (await parseSigningKey(await generateSigningKey()))!;
        const jwt = await new SignJWT({ sub: 'subject' })
            .setProtectedHeader({ alg: OIDC_ALG, kid: key.kid })
            .setIssuer('https://example.com')
            .setExpirationTime('5m')
            .sign(key.privateKey);
        const { payload } = await jwtVerify(jwt, createLocalJWKSet({ keys: [key.publicJwk] }), {
            issuer: 'https://example.com'
        });
        expect(payload.sub).toBe('subject');
    });

    test('rejects anything that is not a private P-256 key', async () => {
        expect(await parseSigningKey('not json')).toBeNull();
        const { d: _d, ...publicOnly } = JSON.parse(await generateSigningKey());
        expect(await parseSigningKey(JSON.stringify(publicOnly))).toBeNull();
        expect(await parseSigningKey(JSON.stringify({ kty: 'RSA', d: 'x' }))).toBeNull();
    });
});

describe('discovery', () => {
    test('puts authorize on the admin host and everything else on the issuer', () => {
        const document = discoveryDocument(oidcEndpoints(platform));
        expect(document.issuer).toBe('https://example.com');
        expect(document.authorization_endpoint).toBe('https://admin.example.com/oauth/authorize');
        expect(document.token_endpoint).toBe('https://example.com/oauth/token');
        expect(document.jwks_uri).toBe('https://example.com/.well-known/jwks.json');
        expect(document.code_challenge_methods_supported).toEqual(['S256']);
        expect(document.response_types_supported).toEqual(['code']);
    });

    test('derives the admin host from the site when it is not configured', () => {
        const endpoints = oidcEndpoints({ env: { PUBLIC_SITE_URL: 'https://example.org' } });
        expect(endpoints.authorizationEndpoint).toBe('https://admin.example.org/oauth/authorize');
    });
});

describe('webfinger', () => {
    const subject = {
        siteUrl: 'https://example.com',
        username: 'Owner',
        email: 'hello@example.com',
        hasAvatar: true,
        issuer: 'https://example.com'
    };

    test('matches the username, the email local part on the site host and the site URL', () => {
        expect(matchesResource('acct:owner@example.com', subject)).toBe(true);
        expect(matchesResource('acct:HELLO@Example.com', subject)).toBe(true);
        expect(matchesResource('https://example.com/', subject)).toBe(true);
        expect(matchesResource('acct:owner@other.example', subject)).toBe(false);
        expect(matchesResource('acct:someone@example.com', subject)).toBe(false);
        expect(matchesResource('https://example.com/blog', subject)).toBe(false);
        expect(
            matchesResource('acct:hello@example.com', { ...subject, email: 'hello@mail.example' })
        ).toBe(false);
    });

    test('links the profile page, avatar and issuer and filters by rel', () => {
        const document = webfingerDocument('acct:owner@example.com', [], subject)!;
        expect(document.subject).toBe('acct:owner@example.com');
        expect(document.aliases).toEqual(['https://example.com']);
        expect(document.links.map(link => link.rel)).toEqual([
            WEBFINGER_RELS.profilePage,
            WEBFINGER_RELS.avatar,
            WEBFINGER_RELS.issuer
        ]);
        const issuerOnly = webfingerDocument(
            'acct:owner@example.com',
            [WEBFINGER_RELS.issuer],
            subject
        )!;
        expect(issuerOnly.links).toEqual([
            { rel: WEBFINGER_RELS.issuer, href: 'https://example.com' }
        ]);
    });

    test('leaves out the avatar and issuer when there are none', () => {
        const document = webfingerDocument('acct:owner@example.com', [], {
            ...subject,
            hasAvatar: false,
            issuer: null
        })!;
        expect(document.links.map(link => link.rel)).toEqual([WEBFINGER_RELS.profilePage]);
    });
});
