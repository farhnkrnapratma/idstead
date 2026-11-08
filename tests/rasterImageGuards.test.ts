// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { rasterBanner, rasterContentImage } from '../apps/admin/src/lib/rasterImage.ts';

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('rejects empty, oversized and unsupported uploads before decoding them', async () => {
    await expect(rasterBanner(new Blob([]))).rejects.toThrow('no larger than 10 MB');
    const oversized = new Blob([new Uint8Array(11 * 1024 * 1024)]);
    await expect(rasterContentImage(oversized)).rejects.toThrow('no larger than 10 MB');
    await expect(rasterBanner(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow(
        'Choose a PNG, JPEG, WebP, AVIF, GIF, or BMP image.'
    );
});

test('reports supported images that cannot be decoded in this browser', async () => {
    const broken = new Blob([PNG_SIGNATURE, new Uint8Array(24)], { type: 'image/png' });
    await expect(rasterBanner(broken)).rejects.toThrow('could not be decoded');
});
