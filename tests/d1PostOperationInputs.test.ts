// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createD1PostOperationStore } from '../packages/data/src/d1/adminPosts.ts';
import { d1Shim } from './support/d1.ts';

const bucket = { put: async () => null, get: async () => null, delete: async () => {} } as never;

test('rejects render uploads and markdown writes for ids that do not form a post path', async () => {
    const { db } = d1Shim();
    const store = createD1PostOperationStore(db, bucket);
    await expect(store.writeRender('not-a-post', 'op', '{}')).rejects.toThrow(
        'postOperations.writeRender'
    );
});

test('leaves operations it cannot find as null and keeps ready idempotent', async () => {
    const { db } = d1Shim();
    const store = createD1PostOperationStore(db, bucket);
    expect(await store.find('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'ada@example.com')).toBeNull();
    await expect(
        store.ready('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'ada@example.com')
    ).resolves.toBeUndefined();
});
