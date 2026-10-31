// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { exportJWK, generateKeyPair, importJWK, type JWK } from 'jose';

export async function generateSigningKey(): Promise<string> {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const { kty, crv, x, y, d } = await exportJWK(privateKey);
    return JSON.stringify({ kty, crv, x, y, d });
}

export async function isSigningKey(raw: string): Promise<boolean> {
    try {
        const jwk = JSON.parse(raw) as JWK;
        if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string') return false;
        await importJWK(jwk, 'ES256');
        return true;
    } catch {
        return false;
    }
}

if (import.meta.main) console.log(await generateSigningKey());
