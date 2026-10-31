// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { parsePostInput } from '../packages/lib/src/server/blogPostInput';

const WASM_MODULE = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));

function request(published: boolean, excerpt: string) {
    const form = new FormData();
    form.set(
        'post',
        JSON.stringify({
            operationId: '42d87a27-2f62-457d-a5bb-d77e63259866',
            id: 'b968d6be-8a09-4c1f-80c4-4e2b47544523',
            revision: 1,
            kind: 'save',
            title: 'Post title',
            slug: 'post-title',
            excerpt,
            tags: [],
            collaborators: [],
            published,
            bannerOperation: 'keep'
        })
    );
    form.set('markdown', '# Post title');
    return new Request('https://example.test/api/internal/admin/posts', {
        method: 'POST',
        body: form
    });
}

describe('parsePostInput excerpt validation', () => {
    test('rejects publishing a post without a manual excerpt', async () => {
        await expect(parsePostInput(request(true, ''), WASM_MODULE)).rejects.toThrow(
            'Excerpt is required to publish a post.'
        );
    });

    test('accepts an empty excerpt on a draft', async () => {
        const input = await parsePostInput(request(false, ''), WASM_MODULE);
        expect(input.post.excerpt).toBeNull();
    });

    test('preserves a manually supplied excerpt on a published post', async () => {
        const input = await parsePostInput(
            request(true, 'A manually written excerpt.'),
            WASM_MODULE
        );
        expect(input.post.excerpt).toBe('A manually written excerpt.');
    });
});
