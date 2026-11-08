// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import encode, { init as initEncoder } from '@jsquash/webp/encode.js';
import { validateContentImage } from '../packages/lib/src/server/validateContentImage.ts';
import {
    ardIndexUnavailableResponse,
    getArdIndexEntries
} from '../packages/lib/src/server/ardIndexServer.ts';

const decoderModule = new WebAssembly.Module(
    await Bun.file('node_modules/@jsquash/webp/codec/dec/webp_dec.wasm').bytes()
);
await initEncoder(
    new WebAssembly.Module(
        await Bun.file('node_modules/@jsquash/webp/codec/enc/webp_enc.wasm').bytes()
    )
);

async function sampleWebp(width = 8, height = 8) {
    const data = new Uint8ClampedArray(width * height * 4).fill(180);
    return new Uint8Array(await encode({ width, height, data, colorSpace: 'srgb' } as never, {}));
}

describe('content image validation', () => {
    test('accepts a decodable WebP and reports its size', async () => {
        const bytes = await sampleWebp(8, 8);
        expect(await validateContentImage(bytes, decoderModule)).toMatchObject({
            width: 8,
            height: 8
        });
    });

    test('rejects bytes that are not a WebP image', async () => {
        await expect(
            validateContentImage(new Uint8Array([1, 2, 3, 4]), decoderModule)
        ).rejects.toThrow('Image must be a valid, still WebP image');
    });
});

describe('ARD index server', () => {
    test('answers unavailable index requests with a retryable 503', async () => {
        const response = ardIndexUnavailableResponse();
        expect(response.status).toBe(503);
        expect(response.headers.get('Retry-After')).toBe('60');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(await response.json()).toMatchObject({ errorCode: 'INTERNAL_ERROR' });
    });

    test('reports an unavailable index when the upstream fetch fails', async () => {
        const failing = (async () => {
            throw new Error('upstream down');
        }) as unknown as typeof fetch;
        await expect(
            getArdIndexEntries('https://example.com', {}, failing as never)
        ).rejects.toThrow('The ARD registry index is temporarily unavailable.');
    });
});
