import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { build } from 'rolldown';
import UPNG from 'upng-js';
import { encodeIndexedPng, encodePng } from '../packages/lib/src/png.ts';
import { validatePng } from '../packages/lib/src/server/validateAvatar.ts';

function noise(size: number, seed = 1) {
    const pixels = new Uint8Array(size * size * 4);
    let state = seed;
    for (let i = 0; i < pixels.length; i += 4) {
        state = (state * 1103515245 + 12345) >>> 0;
        const x = (i / 4) % size;
        const y = Math.floor(i / 4 / size);
        pixels[i] = (x * 255) / size + (state & 31);
        pixels[i + 1] = (y * 255) / size + ((state >> 5) & 31);
        pixels[i + 2] = (state >> 10) & 255;
        pixels[i + 3] = 255;
    }
    return pixels;
}

function paletteSize(png: ArrayBuffer) {
    const bytes = new Uint8Array(png);
    const view = new DataView(png);
    for (let pos = 8; pos < bytes.length;) {
        const length = view.getUint32(pos);
        if (String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)) === 'PLTE') return length / 3;
        pos += length + 12;
    }
    return 0;
}

describe('encodeIndexedPng', () => {
    test('writes a palette PNG that the avatar validator accepts', () => {
        const pixels = noise(64);
        const png = encodeIndexedPng(pixels, 64, 64, 64);
        expect(() => validatePng(png, 64)).not.toThrow();
        expect(paletteSize(png)).toBeLessThanOrEqual(64);
        expect(new Uint8Array(png)[25]).toBe(3);
    });

    test('keeps every pixel close to its source color', () => {
        const pixels = noise(64, 7);
        const decoded = new Uint8Array(
            UPNG.toRGBA8(UPNG.decode(encodeIndexedPng(pixels, 64, 64, 256)))[0]
        );
        let error = 0;
        for (let i = 0; i < pixels.length; i++) error += Math.abs(pixels[i] - decoded[i]);
        expect(error / pixels.length).toBeLessThan(12);
    });

    test('is smaller than the lossless encoding of a noisy image', () => {
        const pixels = noise(256, 3);
        const lossless = encodePng(pixels, 256, 256).byteLength;
        expect(encodeIndexedPng(pixels, 256, 256, 64).byteLength).toBeLessThan(lossless / 2);
    });

    test('keeps transparent pixels transparent', () => {
        const pixels = noise(32, 5);
        for (let i = 3; i < pixels.length / 2; i += 4) pixels[i] = 0;
        const decoded = new Uint8Array(
            UPNG.toRGBA8(UPNG.decode(encodeIndexedPng(pixels, 32, 32, 16)))[0]
        );
        expect(decoded[3]).toBe(0);
        expect(decoded[decoded.length - 1]).toBe(255);
    });

    test('rejects a pixel buffer that does not match the dimensions', () => {
        expect(() => encodeIndexedPng(new Uint8Array(12), 2, 2, 16)).toThrow();
    });

    test('runs in a browser worker bundle without window or require', async () => {
        const output = await build({
            input: new URL('../packages/lib/src/png.ts', import.meta.url).pathname,
            platform: 'browser',
            write: false,
            output: { format: 'iife', name: 'png' }
        });
        const context: {
            TextEncoder: typeof TextEncoder;
            png?: { encodeIndexedPng: typeof encodeIndexedPng };
        } = { TextEncoder };
        runInNewContext(`${output.output[0].code}; this.png = png;`, context);
        const png = context.png!.encodeIndexedPng(noise(16), 16, 16, 8);
        expect(new Uint8Array(png).subarray(1, 4)).toEqual(new Uint8Array([80, 78, 71]));
    });
});
