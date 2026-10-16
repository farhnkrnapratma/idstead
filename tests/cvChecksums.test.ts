import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { cvChecksums, cvKey, isArmoredSignature } from '../packages/lib/src/server/cvChecksums.ts';

const signature = await readFile(new URL('./fixtures/cv-signature.asc', import.meta.url), 'utf8');

describe('CV checksums', () => {
    test('match coreutils output for "abc"', async () => {
        const { files } = await cvChecksums(new TextEncoder().encode('abc'), 'cv.pdf');
        expect(files.md5).toBe('900150983cd24fb0d6963f7d28e17f72  cv.pdf\n');
        expect(files.sha256).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  cv.pdf\n'
        );
        expect(files.sha512.startsWith('ddaf35a193617aba')).toBe(true);
        expect(files.b2.startsWith('ba80a53f981c4d0d6a2797b69f12f6e9')).toBe(true);
    });

    test('keys stay inside cv/', () => {
        expect(cvKey('CV-Ada-1234567-v1.0.pdf', 'b2')).toBe('cv/CV-Ada-1234567-v1.0.pdf.b2');
        expect(() => cvKey('../x.pdf')).toThrow('Invalid CV filename.');
    });
});

describe('CV signatures', () => {
    test('accepts a gpg --armor --detach-sign signature', () => {
        expect(isArmoredSignature(signature)).toBe(true);
        expect(isArmoredSignature(signature.replace(/\n/g, '\r\n'))).toBe(true);
    });

    test.each([
        ['empty', ''],
        ['public key', signature.replaceAll('SIGNATURE', 'PUBLIC KEY BLOCK')],
        ['script', `${signature}<script>`],
        ['oversized', signature + 'A'.repeat(20_000)]
    ])('rejects %s', (_label, value) => {
        expect(isArmoredSignature(value)).toBe(false);
    });
});
