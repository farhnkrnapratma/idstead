import { exportJWK, generateKeyPair } from 'jose';

export async function generateSigningKey(): Promise<string> {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const { kty, crv, x, y, d } = await exportJWK(privateKey);
    return JSON.stringify({ kty, crv, x, y, d });
}

if (import.meta.main) console.log(await generateSigningKey());
