// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, expect, mock, test } from 'bun:test';

const objects = new Map<string, Uint8Array>();
const state = { corrupt: false };

const bucket = {
    put: async (key: string, bytes: Uint8Array) => {
        objects.set(key, state.corrupt ? new Uint8Array([0]) : bytes);
    }
};

const realR2 = await import('../packages/lib/src/server/r2.ts');
mock.module('../packages/lib/src/server/r2.ts', () => ({
    ...realR2,
    assetBucket: async () => bucket,
    readObjectBytes: async (_bucket: unknown, key: string) => objects.get(key) ?? null
}));

const { putContentAsset } = await import('../packages/lib/src/server/blogContentStorage.ts');

beforeEach(() => {
    objects.clear();
    state.corrupt = false;
});

test('stores a content asset and verifies the bytes read back', async () => {
    await putContentAsset(
        undefined,
        'content/images/a.webp',
        new Uint8Array([7, 8, 9]),
        'image/webp'
    );
    expect(objects.get('content/images/a.webp')).toEqual(new Uint8Array([7, 8, 9]));
});

test('rejects an asset that does not read back as written', async () => {
    state.corrupt = true;
    await expect(
        putContentAsset(undefined, 'content/images/b.webp', new Uint8Array([1, 2]), 'image/webp')
    ).rejects.toThrow('Stored content asset verification failed.');
});
