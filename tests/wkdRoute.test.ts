// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { wkdKey } from '../packages/lib/src/server/wkd.ts';
import { wkdHash } from '../packages/domain/src/openpgpKey.ts';

const armored = await Bun.file(new URL('./fixtures/openpgp/ada.pub.asc', import.meta.url)).text();
const binary = await Bun.file(new URL('./fixtures/openpgp/ada.pub.gpg', import.meta.url)).bytes();
const key = {
    fingerprint: '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C',
    armored,
    algorithm: 'Ed25519',
    createdAt: null,
    expiresAt: null,
    userIds: [
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Ada', email: 'ada@example.org' }
    ],
    keyservers: []
};

describe('WKD direct method', () => {
    test('serves the binary key for an address on the site domain', async () => {
        expect(await wkdKey(await wkdHash('ada'), key, 'https://example.com')).toEqual(binary);
    });

    test('does not answer for other addresses, malformed hashes or a missing key', async () => {
        const hash = await wkdHash('ada');
        expect(await wkdKey(await wkdHash('bob'), key, 'https://example.com')).toBeNull();
        expect(await wkdKey(hash.toUpperCase(), key, 'https://example.com')).toBeNull();
        expect(await wkdKey(hash, key, 'https://example.org.evil')).toBeNull();
        expect(await wkdKey(hash, null, 'https://example.com')).toBeNull();
    });
});
