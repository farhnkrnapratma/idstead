import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { wkdKey } from '../packages/lib/src/server/wkd.ts';
import { wkdHash } from '../packages/lib/src/openpgpKey.ts';

const armored = await readFile(new URL('./fixtures/openpgp/ada.pub.asc', import.meta.url), 'utf8');
const binary = new Uint8Array(
    await readFile(new URL('./fixtures/openpgp/ada.pub.gpg', import.meta.url))
);
const key = {
    fingerprint: '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C',
    armored,
    algorithm: 'Ed25519',
    createdAt: null,
    expiresAt: null,
    userIds: [
        { name: 'Ada', email: 'ada@fkp.my.id' },
        { name: 'Ada', email: 'ada@example.org' }
    ],
    keyservers: []
};

describe('WKD direct method', () => {
    test('serves the binary key for an address on the site domain', async () => {
        expect(await wkdKey(await wkdHash('ada'), key, 'https://fkp.my.id')).toEqual(binary);
    });

    test('does not answer for other addresses, malformed hashes or a missing key', async () => {
        const hash = await wkdHash('ada');
        expect(await wkdKey(await wkdHash('bob'), key, 'https://fkp.my.id')).toBeNull();
        expect(await wkdKey(hash.toUpperCase(), key, 'https://fkp.my.id')).toBeNull();
        expect(await wkdKey(hash, key, 'https://example.org.evil')).toBeNull();
        expect(await wkdKey(hash, null, 'https://fkp.my.id')).toBeNull();
    });
});
