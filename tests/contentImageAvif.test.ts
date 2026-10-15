import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { CONTENT_IMAGE_LIMIT } from '../packages/lib/src/blogContentImage.ts';
import { validateContentImageAvif } from '../packages/lib/src/server/validateContentImage.ts';

const avif = new Uint8Array(await readFile(new URL('./fixtures/avatar-512.avif', import.meta.url)));

describe('validateContentImageAvif', () => {
    test('accepts an AVIF that matches the WebP dimensions', () => {
        expect(validateContentImageAvif(avif, { width: 512, height: 512 })).toMatchObject({
            width: 512,
            height: 512,
            type: 'image/avif'
        });
    });

    test('rejects an AVIF whose dimensions differ from the WebP', () => {
        expect(() => validateContentImageAvif(avif, { width: 640, height: 512 })).toThrow();
    });

    test('rejects WebP bytes sent as the AVIF variant', () => {
        const webp = new Uint8Array(32);
        webp.set(new TextEncoder().encode('RIFF'), 0);
        webp.set(new TextEncoder().encode('WEBPVP8L'), 8);
        expect(() => validateContentImageAvif(webp, { width: 512, height: 512 })).toThrow();
    });

    test('rejects an AVIF over the content image limit', () => {
        const oversized = new Uint8Array(CONTENT_IMAGE_LIMIT + 1);
        oversized.set(avif);
        expect(() => validateContentImageAvif(oversized, { width: 512, height: 512 })).toThrow();
    });
});
