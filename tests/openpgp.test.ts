import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import {
    parseDetachedSignature,
    parsePublicKey,
    verifyDetachedSignature,
    verifyKeyserver
} from '../packages/lib/src/server/openpgp.ts';
import {
    dearmor,
    formatFingerprint,
    safeKeyserverUrl,
    wkdEmails,
    wkdHash
} from '../packages/domain/src/openpgpKey.ts';
import { buildCvBundle } from '../packages/lib/src/server/cvBundle.ts';
import { cvChecksums } from '../packages/lib/src/server/cvChecksums.ts';

const fixture = async (name: string) =>
    new Uint8Array(await readFile(new URL(`./fixtures/openpgp/${name}`, import.meta.url)));
const FPR = '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C';
const pdf = await fixture('cv.pdf');
const armoredKey = await fixture('ada.pub.asc');

describe('OpenPGP public keys', () => {
    test('reads armored and binary keys with their identity', async () => {
        const armored = await parsePublicKey(armoredKey);
        const binary = await parsePublicKey(await fixture('ada.pub.gpg'));
        expect(armored.fingerprint).toBe(FPR);
        expect(binary.fingerprint).toBe(FPR);
        expect(armored.userIds).toEqual([{ name: 'Ada Lovelace', email: 'ada@example.org' }]);
        expect(armored.algorithm).toBe('Ed25519');
        expect(armored.expiresAt).toBeNull();
        expect(armored.armored.startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----')).toBe(true);
    });

    test('rejects private keys and junk', async () => {
        await expect(parsePublicKey(await fixture('private.asc'))).rejects.toThrow('private key');
        await expect(parsePublicKey(new TextEncoder().encode('hello'))).rejects.toThrow(
            'not an OpenPGP public key'
        );
        await expect(parsePublicKey(new Uint8Array(70_000))).rejects.toThrow('64 KiB');
    });

    test('dearmors to the exported binary key', async () => {
        expect(dearmor(new TextDecoder().decode(armoredKey))).toEqual(await fixture('ada.pub.gpg'));
    });
});

const { key } = await parsePublicKey(armoredKey);

describe('detached CV signatures', () => {
    test.each(['cv.pdf.asc', 'cv.pdf.sig'])('verifies %s and returns both formats', async name => {
        const parsed = await parseDetachedSignature(await fixture(name));
        await verifyDetachedSignature(pdf, parsed.signature, key);
        expect(parsed.asc.startsWith('-----BEGIN PGP SIGNATURE-----')).toBe(true);
        const roundTrip = await parseDetachedSignature(parsed.sig);
        await verifyDetachedSignature(pdf, roundTrip.signature, key);
    });

    test('rejects a signature over another file', async () => {
        const parsed = await parseDetachedSignature(await fixture('cv.pdf.sig'));
        await expect(
            verifyDetachedSignature(new TextEncoder().encode('other'), parsed.signature, key)
        ).rejects.toThrow('does not match the current PDF');
    });

    test('rejects a signature made with another key', async () => {
        const parsed = await parseDetachedSignature(await fixture('cv.pdf.mallory.sig'));
        await expect(verifyDetachedSignature(pdf, parsed.signature, key)).rejects.toThrow(
            `not your active key ${FPR}`
        );
    });

    test('rejects a signed message, a public key and oversized input', async () => {
        await expect(parseDetachedSignature(await fixture('cv.pdf.gpg'))).rejects.toThrow(
            '--detach-sign'
        );
        await expect(parseDetachedSignature(armoredKey)).rejects.toThrow('--detach-sign');
        await expect(parseDetachedSignature(new Uint8Array(17 * 1024))).rejects.toThrow('16 KiB');
    });
});

describe('key discovery', () => {
    test('hashes WKD local parts like GnuPG', async () => {
        expect(await wkdHash('Joe.Doe')).toBe('iy9q119eutrkn8s1mk4r39qejnbu3n5q');
    });

    test('lists only addresses on the site domain', () => {
        const ids = [
            { name: 'A', email: 'a@example.com' },
            { name: 'A', email: 'a@gmail.com' }
        ];
        expect(wkdEmails(ids, 'www.example.com')).toEqual(['a@example.com']);
    });

    test('accepts a keyserver only when it serves the same key', async () => {
        const serve = (body: Uint8Array) =>
            (async () => new Response(body)) as unknown as typeof fetch;
        await verifyKeyserver('https://keys.example/k', FPR, serve(armoredKey));
        await expect(
            verifyKeyserver('https://keys.example/k', '0'.repeat(40), serve(armoredKey))
        ).rejects.toThrow('does not serve key');
        await expect(
            verifyKeyserver('http://keys.example/k', FPR, serve(armoredKey))
        ).rejects.toThrow('https');
    });

    test('only keeps keyserver URLs that are safe to paste into a shell', () => {
        expect(
            safeKeyserverUrl('https://keys.openpgp.org/vks/v1/by-fingerprint/' + FPR)
        ).not.toBeNull();
        expect(
            safeKeyserverUrl(
                `https://keyserver.ubuntu.com/pks/lookup?op=get&options=mr&search=0x${FPR}`
            )
        ).not.toBeNull();
        for (const url of [
            "https://h/x';id;'",
            'https://h/x$(id)',
            'https://h/a b',
            'http://h/x',
            'https://user:pw@h/x'
        ])
            expect(safeKeyserverUrl(url)).toBeNull();
        expect(wkdEmails([{ name: '', email: 'a$(id)@example.com' }], 'example.com')).toEqual([]);
    });

    test('groups fingerprints by four', () => {
        expect(formatFingerprint(FPR)).toBe('73C0 32AD 78AC 6F2E 7CE7 81A2 7ABA 82BF 0C80 A58C');
    });
});

describe('verification bundle', () => {
    test('holds checksums, both signatures, the key and instructions', async () => {
        const filename = 'CV-Ada-1234567-v1.0.pdf';
        const { files } = await cvChecksums(pdf, filename);
        const parsed = await parseDetachedSignature(await fixture('cv.pdf.sig'));
        const zip = unzipSync(
            buildCvBundle({
                filename,
                pdf,
                checksumFiles: files,
                signature: { asc: parsed.asc, sig: parsed.sig },
                publicKey: new TextDecoder().decode(armoredKey),
                key: {
                    fingerprint: FPR,
                    userIds: [{ name: 'Ada', email: 'ada@example.com' }],
                    keyservers: []
                },
                siteUrl: 'https://example.com',
                apiBase: 'https://api.example.com',
                date: new Date('2026-10-17T00:00:00Z')
            })
        );
        expect(Object.keys(zip).sort()).toEqual(
            [
                'VERIFY.txt',
                filename,
                `${filename}.asc`,
                `${filename}.b2`,
                `${filename}.md5`,
                `${filename}.sha256`,
                `${filename}.sha512`,
                `${filename}.sig`,
                'publickey.asc'
            ].sort()
        );
        const verify = strFromU8(zip['VERIFY.txt']);
        expect(verify).toContain('Ada <ada@example.com>');
        expect(verify).toContain('gpg --auto-key-locate clear,wkd --locate-keys ada@example.com');
        expect(verify).toContain('curl -sSf https://example.com/pgp.asc | gpg --import');
        expect(strFromU8(zip[`${filename}.sha256`])).toBe(files.sha256);
        expect(zip[filename]).toEqual(pdf);
    });

    test('says so when the CV is unsigned', async () => {
        const { files } = await cvChecksums(pdf, 'cv.pdf');
        const zip = unzipSync(
            buildCvBundle({
                filename: 'cv.pdf',
                pdf,
                checksumFiles: files,
                signature: null,
                publicKey: null,
                key: null,
                siteUrl: '',
                apiBase: 'https://api.example.com',
                date: new Date()
            })
        );
        expect(zip['cv.pdf.sig']).toBeUndefined();
        expect(strFromU8(zip['VERIFY.txt'])).toContain('not signed yet');
    });
});
