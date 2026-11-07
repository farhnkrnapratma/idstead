// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { boundedBody, parsePostInput } from '../packages/lib/src/server/blogPostInput.ts';

const OP = '0f8fad5b-d9cb-469f-a165-70867728950e';
const WASM = {} as WebAssembly.Module;

function postRequest(metadata: unknown, markdown?: string, headers: Record<string, string> = {}) {
    const form = new FormData();
    form.set('post', typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
    if (markdown !== undefined) form.set('markdown', markdown);
    return new Request('https://admin.example.com/api/internal/admin/posts', {
        method: 'POST',
        body: form,
        headers
    });
}

const save = (overrides: Record<string, unknown> = {}) => ({
    kind: 'save',
    operationId: OP,
    id: OP,
    revision: null,
    published: false,
    slug: 'hello-world',
    title: 'Hello',
    excerpt: 'Hi',
    tags: ['svelte'],
    collaborators: [],
    bannerOperation: 'keep',
    ...overrides
});

async function failure(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error('expected a rejection');
}

describe('boundedBody', () => {
    test('rejects declared payloads above the limit', async () => {
        const request = new Request('https://x.test/', {
            method: 'POST',
            body: 'ab',
            headers: { 'content-length': '999' }
        });
        expect(await failure(boundedBody(request, 10))).toBe('Post payload is too large.');
    });

    test('rejects streamed payloads that grow past the limit', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(6));
                controller.enqueue(new Uint8Array(6));
                controller.close();
            }
        });
        const request = new Request('https://x.test/', {
            method: 'POST',
            body: stream,
            duplex: 'half'
        } as RequestInit);
        expect(await failure(boundedBody(request, 10))).toBe('Post payload is too large.');
    });

    test('rejects requests without a body and copies the rest', async () => {
        const empty = new Request('https://x.test/', { method: 'GET' });
        expect(await failure(boundedBody(empty))).toBe('Post data is required.');
        const body = new Request('https://x.test/', {
            method: 'POST',
            body: 'hello',
            headers: { 'content-type': 'text/plain' }
        });
        const copied = await boundedBody(body);
        expect(await copied.text()).toBe('hello');
        expect(copied.headers.get('content-type')).toBe('text/plain');
    });
});

describe('parsePostInput', () => {
    test('requires metadata and a valid operation envelope', async () => {
        expect(
            await failure(
                parsePostInput(
                    new Request('https://x.test/', { method: 'POST', body: new FormData() }),
                    WASM
                )
            )
        ).toBe('Post metadata is required.');
        expect(await failure(parsePostInput(postRequest('{not json'), WASM))).toBeDefined();
        expect(
            await failure(parsePostInput(postRequest({ ...save(), operationId: 'nope' }), WASM))
        ).toBe('Invalid operation or post ID.');
        expect(await failure(parsePostInput(postRequest({ ...save(), revision: -1 }), WASM))).toBe(
            'A post revision is required.'
        );
        expect(
            await failure(parsePostInput(postRequest({ ...save(), kind: 'archive' }), WASM))
        ).toBe('Invalid post operation.');
    });

    test('checks the publication flag, slug and publishing rules', async () => {
        expect(
            await failure(parsePostInput(postRequest({ ...save(), published: 'yes' }), WASM))
        ).toBe('Invalid publication status.');
        expect(
            await failure(parsePostInput(postRequest({ ...save(), slug: 'Not A Slug' }), WASM))
        ).toBe('Invalid post slug.');
        expect(
            await failure(
                parsePostInput(postRequest({ ...save(), published: true, excerpt: '' }), WASM)
            )
        ).toBe('Excerpt is required to publish a post.');
    });

    test('checks tags, collaborators, markdown and banner actions', async () => {
        expect(
            await failure(
                parsePostInput(postRequest({ ...save(), tags: 'not-a-list' }, '# Body'), WASM)
            )
        ).toBe('Invalid post list.');
        expect(
            await failure(
                parsePostInput(
                    postRequest({ ...save(), collaborators: ['bad user!'] }, '# Body'),
                    WASM
                )
            )
        ).toBe('Invalid collaborator username.');
        expect(await failure(parsePostInput(postRequest(save(), '   '), WASM))).toBe(
            'Markdown is required and must be no larger than 2 MiB.'
        );
        expect(await failure(parsePostInput(postRequest(save(), 'a\u0000b'), WASM))).toBe(
            'Markdown is required and must be no larger than 2 MiB.'
        );
        expect(
            await failure(
                parsePostInput(postRequest(save({ bannerOperation: 'shrink' }), '# Body'), WASM)
            )
        ).toBe('Invalid banner operation.');
    });

    test('keeps a valid save request with its markdown', async () => {
        const parsed = (await parsePostInput(
            postRequest(save({ revision: 1 }), '# Body'),
            WASM
        )) as unknown as Record<string, unknown>;
        expect(JSON.stringify(parsed)).toContain('hello-world');
    });

    test('enforces banner rules for new posts and removals', async () => {
        expect(
            await failure(
                parsePostInput(postRequest(save({ bannerOperation: 'keep' }), '# Body'), WASM)
            )
        ).toBe('Banner image is required.');
        expect(
            await failure(
                parsePostInput(
                    postRequest(save({ revision: 1, bannerOperation: 'remove' }), '# Body'),
                    WASM
                )
            )
        ).toBe('Banner image is required.');
        expect(
            await failure(
                parsePostInput(
                    postRequest(save({ revision: 1, bannerOperation: 'replace' }), '# Body'),
                    WASM
                )
            )
        ).toBe('A WebP banner no larger than 500 KiB is required.');
    });

    test('rejects overlong titles and unknown content licenses', async () => {
        expect(
            await failure(
                parsePostInput(postRequest(save({ title: 'x'.repeat(61) }), '# Body'), WASM)
            )
        ).toBe('Invalid post text.');
        expect(
            await failure(
                parsePostInput(
                    postRequest(save({ contentLicense: 'not-a-license' }), '# Body'),
                    WASM
                )
            )
        ).toBe('Invalid post license.');
    });
});
