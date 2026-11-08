// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createD1CommentRepository, createD1RenderStore } from '../packages/data/src/d1/blog.ts';

const failingDb = {
    prepare: () => {
        throw new Error('db down');
    }
} as never;
const bucket = { put: async () => null, get: async () => null, delete: async () => {} } as never;

test('reports a failing render candidate lookup as a data error', async () => {
    const store = createD1RenderStore(failingDb, bucket);
    await expect(store.listRenderCandidates(10)).rejects.toThrow('renders.listRenderCandidates');
});
