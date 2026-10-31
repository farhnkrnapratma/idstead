// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { SignJWT, createLocalJWKSet, jwtVerify } from 'jose';
import type { OidcSigningKey } from './keys';
import { OIDC_ALG } from './keys';
import { randomToken } from './clients';

export const ID_TOKEN_TTL_SECONDS = 300;
export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_TYPE = 'at+jwt';

export interface ClaimsProfile {
    name: string;
    username: string;
    email: string;
    siteUrl: string;
    avatarVersion?: string | null;
    updatedAt?: string;
}

export function profileClaims(
    profile: ClaimsProfile | null,
    scopes: string[],
    issuer: string
): Record<string, unknown> {
    if (!profile) return {};
    const claims: Record<string, unknown> = {};
    if (scopes.includes('profile')) {
        if (profile.name) claims.name = profile.name;
        if (profile.username) claims.preferred_username = profile.username;
        if (profile.avatarVersion) claims.picture = `${issuer}/avatar.png`;
        claims.website = profile.siteUrl || issuer;
        const updated = profile.updatedAt ? Date.parse(profile.updatedAt) : NaN;
        if (Number.isFinite(updated)) claims.updated_at = Math.floor(updated / 1000);
    }
    if (scopes.includes('email') && profile.email) {
        claims.email = profile.email;
        claims.email_verified = false;
    }
    return claims;
}

export interface TokenSubject {
    issuer: string;
    subject: string;
    clientId: string;
    grantId: string;
    scopes: string[];
    authTime: number;
    nonce?: string | null;
    claims: Record<string, unknown>;
}

export async function signIdToken(key: OidcSigningKey, token: TokenSubject, now: number) {
    return new SignJWT({
        ...token.claims,
        auth_time: token.authTime,
        ...(token.nonce ? { nonce: token.nonce } : {})
    })
        .setProtectedHeader({ alg: OIDC_ALG, kid: key.kid, typ: 'JWT' })
        .setIssuer(token.issuer)
        .setSubject(token.subject)
        .setAudience(token.clientId)
        .setIssuedAt(now)
        .setExpirationTime(now + ID_TOKEN_TTL_SECONDS)
        .sign(key.privateKey);
}

export async function signAccessToken(key: OidcSigningKey, token: TokenSubject, now: number) {
    return new SignJWT({
        client_id: token.clientId,
        scope: token.scopes.join(' '),
        gid: token.grantId,
        auth_time: token.authTime
    })
        .setProtectedHeader({ alg: OIDC_ALG, kid: key.kid, typ: ACCESS_TOKEN_TYPE })
        .setIssuer(token.issuer)
        .setSubject(token.subject)
        .setAudience(token.issuer)
        .setJti(randomToken(16))
        .setIssuedAt(now)
        .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
        .sign(key.privateKey);
}

export interface AccessTokenClaims {
    subject: string;
    clientId: string;
    grantId: string;
    scopes: string[];
}

export async function verifyAccessToken(
    key: OidcSigningKey,
    token: string,
    issuer: string
): Promise<AccessTokenClaims | null> {
    try {
        const { payload } = await jwtVerify(token, createLocalJWKSet({ keys: [key.publicJwk] }), {
            issuer,
            audience: issuer,
            typ: ACCESS_TOKEN_TYPE,
            algorithms: [OIDC_ALG]
        });
        if (
            typeof payload.sub !== 'string'
            || typeof payload.client_id !== 'string'
            || typeof payload.gid !== 'string'
            || typeof payload.scope !== 'string'
        )
            return null;
        return {
            subject: payload.sub,
            clientId: payload.client_id,
            grantId: payload.gid,
            scopes: payload.scope.split(' ').filter(Boolean)
        };
    } catch {
        return null;
    }
}
