// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: FeedbackPage } =
    (await import('../apps/web/src/routes/feedback/+page.svelte')) as { default: never };

const realFetch = globalThis.fetch;
const mounted: object[] = [];
const requests: string[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const author = {
    name: 'Ada Lovelace',
    username: 'ada',
    siteUrl: 'https://example.com/',
    email: 'ada@example.com',
    avatar: ''
};

function setPage(contactEmail: string, authorEmail = author.email) {
    (page as { data: unknown }).data = { author: { ...author, email: authorEmail }, contactEmail };
    (page as unknown as { url: URL }).url = new URL('https://example.com/feedback');
}

function field(name: string, value: string) {
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`
    );
    if (!element) throw new Error(`${name} field missing`);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    flushSync();
}

beforeEach(() => {
    requests.length = 0;
    globalThis.fetch = (async (input: string) => {
        requests.push(String(input));
        return Response.json({ ok: true });
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

test('validates the feedback form and submits it to the contact endpoint', async () => {
    setPage('ada@example.com');
    mounted.push(mount(FeedbackPage, { target: document.body, props: {} }));
    await settle();

    field('name', '');
    field('email', 'not-an-email');
    field('url', 'javascript:alert(1)');
    field('message', '');
    document
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();
    expect(requests).toEqual([]);

    field('name', 'Reader');
    field('email', 'reader@example.com');
    field('url', 'https://reader.example.com');
    field('message', 'Thanks for the site, the feedback is useful.');
    await settle();
    document
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();
    expect(requests.some(url => url.includes('/api/internal/contact'))).toBe(true);
}, 60000);

test('explains when no contact address is configured', async () => {
    setPage('', '');
    mounted.push(mount(FeedbackPage, { target: document.body, props: {} }));
    await settle();
    expect(document.body.textContent).toContain('Feedback is not available yet');
}, 60000);
