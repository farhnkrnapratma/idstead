// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { avifSources, bannerCrop } from '../packages/lib/src/blogBanner.ts';

describe('bannerCrop', () => {
    test('rejects sizes that are not usable image dimensions', () => {
        for (const [width, height] of [
            [0, 640],
            [1280, 0],
            [1.5, 640],
            [Number.MAX_SAFE_INTEGER, 2]
        ]) {
            expect(() => bannerCrop(width, height)).toThrow(
                'Choose an image no larger than 40 megapixels.'
            );
        }
    });

    test('rejects images smaller than the banner unless upscaling is allowed', () => {
        expect(() => bannerCrop(1000, 600)).toThrow(
            'Choose an image at least 1280 × 640 pixels after orientation.'
        );
        expect(bannerCrop(1000, 600, true)).toEqual({ x: 0, y: 50, width: 1000, height: 500 });
    });

    test('crops the largest centred 2:1 region', () => {
        expect(bannerCrop(2560, 1280)).toEqual({ x: 0, y: 0, width: 2560, height: 1280 });
        expect(bannerCrop(1600, 1200)).toEqual({ x: 0, y: 200, width: 1600, height: 800 });
    });
});

describe('avifSources', () => {
    test('offers an AVIF source for WebP banners only', () => {
        expect(avifSources('https://cdn.example.com/banner.webp?v=2')).toEqual([
            { srcset: 'https://cdn.example.com/banner.avif?v=2', type: 'image/avif' }
        ]);
        expect(avifSources('https://cdn.example.com/banner.webp')).toEqual([
            { srcset: 'https://cdn.example.com/banner.avif', type: 'image/avif' }
        ]);
        expect(avifSources('https://cdn.example.com/banner.png')).toEqual([]);
        expect(avifSources(null)).toEqual([]);
    });
});
