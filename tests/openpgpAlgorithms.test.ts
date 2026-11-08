// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { generateKey } from 'openpgp';
import { parsePublicKey } from '../packages/lib/src/server/openpgp.ts';

const userIDs = [{ name: 'Grace Hopper', email: 'grace@example.org' }];

test('labels RSA and NIST curve keys with their size or curve', async () => {
    const rsa = await generateKey({ type: 'rsa', rsaBits: 2048, userIDs, format: 'armored' });
    expect((await parsePublicKey(new TextEncoder().encode(rsa.publicKey))).algorithm).toBe(
        'RSA 2048'
    );

    const ecc = await generateKey({ type: 'ecc', curve: 'nistP256', userIDs, format: 'armored' });
    expect((await parsePublicKey(new TextEncoder().encode(ecc.publicKey))).algorithm).toMatch(
        /ecdsa|p256/i
    );
}, 60_000);
