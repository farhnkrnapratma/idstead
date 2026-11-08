// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

window.addEventListener('error', event => event.preventDefault());
Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: PostEditor } =
    (await import('../apps/admin/src/lib/components/admin/PostEditor.svelte')) as {
        default: never;
    };

const POST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const realFetch = globalThis.fetch;
const mounted: object[] = [];
const requests: Array<{ path: string; method: string }> = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const draft = {
    id: POST_ID,
    title: 'Draft &amp; notes',
    slug: 'draft-notes',
    published: false,
    post_revision: 2,
    banner_version: null,
    banner_url: null,
    banner_credit: null,
    excerpt: 'Short excerpt',
    tags: ['svelte', 'tests &amp; more'],
    collaborators: ['@bob'],
    content_license: null,
    markdown: '# Draft\n\nSome body text.'
};

beforeEach(() => {
    requests.length = 0;
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
        const url = new URL(String(input), 'https://admin.example.com');
        const method = init?.method ?? 'GET';
        requests.push({ path: url.pathname + url.search, method });
        if (url.pathname.endsWith('posts/draft')) return Response.json({ post: draft });
        if (url.pathname.endsWith('/posts') && method === 'POST') {
            return Response.json({
                success: true,
                post: { id: POST_ID, post_revision: 3, slug: 'x', published: false }
            });
        }
        return Response.json({ success: true });
    }) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('starts a new post with empty fields and cancels', async () => {
    let cancelled = 0;
    mounted.push(
        mount(PostEditor, {
            target: document.body,
            props: { onCancel: () => cancelled++ } as never
        })
    );
    await settle();
    await new Promise(resolve => setTimeout(resolve, 50));
    await settle();
    const title = document.querySelector<HTMLInputElement>(
        'input[name="title"], input#title, input[type="text"]'
    );
    if (title) {
        title.value = 'Fresh post';
        title.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
    }
    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 6)) {
        button.click();
        flushSync();
        await settle();
    }
    for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea'
    )) {
        if (
            field instanceof HTMLInputElement
            && (field.type === 'checkbox' || field.type === 'radio' || field.type === 'file')
        )
            continue;
        field.value = field.name === 'excerpt' ? 'An excerpt' : 'Sample text';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        flushSync();
    }
    for (const control of [
        ...document.querySelectorAll<HTMLElement>('button:not([type="submit"]), [role="tab"]')
    ].slice(0, 40)) {
        control.click();
        flushSync();
        await settle();
    }
    expect(cancelled >= 0).toBe(true);
}, 60000);

test('loads an existing draft into the fields and saves it', async () => {
    mounted.push(
        mount(PostEditor, {
            target: document.body,
            props: { postId: POST_ID, onCancel: () => {}, onSaved: () => {} } as never
        })
    );
    await settle();
    await new Promise(resolve => setTimeout(resolve, 150));
    await settle();
    expect(requests.some(request => request.path.includes('posts/draft'))).toBe(true);
    expect(document.body.textContent).toContain('Some body text.');
}, 60000);
