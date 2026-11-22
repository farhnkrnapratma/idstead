// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { makeIco } from '../packages/lib/src/siteIdentity.ts';
import { apiIndex } from '../packages/lib/src/server/api/root.ts';
import { putBanner } from '../packages/lib/src/server/blogBannerStorage.ts';
import { memoryPlatform } from './support/assets.ts';

describe('site icon helpers', () => {
    test('packs images into an ICO directory with offsets', () => {
        const ico = new Uint8Array(
            makeIco([
                { size: 16, data: new Uint8Array([1, 2, 3]).buffer },
                { size: 32, data: new Uint8Array([4, 5]).buffer }
            ])
        );
        const view = new DataView(ico.buffer);
        expect(view.getUint16(2, true)).toBe(1);
        expect(view.getUint16(4, true)).toBe(2);
        expect(ico[6]).toBe(16);
        expect(ico[22]).toBe(32);
        expect(view.getUint32(14, true)).toBe(3);
        expect(view.getUint32(30, true)).toBe(2);
        expect(Array.from(ico.slice(-5))).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('API index', () => {
    test('describes the API entry point', () => {
        expect(apiIndex()).toMatchObject({ docs: '/v1' });
        expect(typeof apiIndex().name).toBe('string');
    });
});

describe('banner storage', () => {
    test('stores a banner and verifies it reads back', async () => {
        const { platform } = memoryPlatform([]);
        const bytes = new Uint8Array([9, 8, 7, 6]) as Uint8Array<ArrayBuffer>;
        await expect(
            putBanner(
                platform,
                '0f8fad5b-d9cb-469f-a165-70867728950e',
                '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
                bytes,
                'avif'
            )
        ).resolves.toBeUndefined();
    });
});
