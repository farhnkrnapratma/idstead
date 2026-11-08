// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { processSiteBanner } from '../apps/admin/src/lib/processSiteBanner.ts';

const globals = globalThis as Record<string, unknown>;
const realBitmap = globals.createImageBitmap;

afterEach(() => {
    if (realBitmap === undefined) delete globals.createImageBitmap;
    else globals.createImageBitmap = realBitmap;
});

test('rejects values that are not files and files above the source limit', async () => {
    await expect(processSiteBanner(new Blob(['x']) as never)).rejects.toThrow('Expected a file.');
    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'banner.png', {
        type: 'image/png'
    });
    await expect(processSiteBanner(oversized)).rejects.toThrow('no larger than 10 MB');
});

test('rejects banners whose decoded size exceeds the pixel limit', async () => {
    globals.createImageBitmap = async () => ({ width: 2000, height: 30000, close() {} });
    const file = new File([new Uint8Array([1, 2, 3])], 'banner.png', { type: 'image/png' });
    await expect(processSiteBanner(file)).rejects.toThrow('no larger than 40 megapixels');
});
