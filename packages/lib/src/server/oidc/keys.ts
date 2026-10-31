// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as privateEnv from '$app/env/private';
import { calculateJwkThumbprint, importJWK, type JWK } from 'jose';

export const OIDC_ALG = 'ES256';

export interface OidcSigningKey {
    kid: string;
    privateKey: CryptoKey;
    publicJwk: JWK;
}

let parsed: { raw: string; key: Promise<OidcSigningKey | null> } | undefined;

function rawSigningKey(platform: unknown): string {
    const value =
        (platform as { env?: { OIDC_SIGNING_KEY?: string } } | undefined)?.env?.OIDC_SIGNING_KEY
        ?? (privateEnv as Record<string, string | undefined>).OIDC_SIGNING_KEY
        ?? process.env.OIDC_SIGNING_KEY
        ?? '';
    return value.trim();
}

export async function parseSigningKey(raw: string): Promise<OidcSigningKey | null> {
    let jwk: JWK;
    try {
        jwk = JSON.parse(raw);
    } catch {
        return null;
    }
    if (
        jwk?.kty !== 'EC'
        || jwk.crv !== 'P-256'
        || typeof jwk.x !== 'string'
        || typeof jwk.y !== 'string'
        || typeof jwk.d !== 'string'
    )
        return null;

    const publicJwk: JWK = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    const kid = await calculateJwkThumbprint(publicJwk, 'sha256');
    const privateKey = await importJWK({ ...publicJwk, d: jwk.d }, OIDC_ALG);
    if (privateKey instanceof Uint8Array) return null;
    return { kid, privateKey, publicJwk: { ...publicJwk, kid, alg: OIDC_ALG, use: 'sig' } };
}

export function oidcSigningKey(platform: unknown): Promise<OidcSigningKey | null> {
    const raw = rawSigningKey(platform);
    if (!raw) return Promise.resolve(null);
    if (parsed?.raw !== raw) parsed = { raw, key: parseSigningKey(raw).catch(() => null) };
    return parsed.key;
}
