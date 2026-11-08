// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: BlogIndexPage } =
    (await import('../apps/web/src/routes/(site)/blog/+page.svelte')) as { default: never };

const realFetch = globalThis.fetch;
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const posts = [
    {
        id: 'post-1',
        slug: 'alpha',
        title: 'Alpha notes',
        excerpt: 'About alpha',
        created_at: '2026-03-01T10:00:00.000Z',
        updated_at: null,
        read_time: '3 min read',
        comment_count: 4,
        views_count: 20,
        tags: ['svelte', 'tests'],
        pinned: true,
        banner_url: null
    },
    {
        id: 'post-2',
        slug: 'beta',
        title: 'Beta &amp; gamma',
        excerpt: null,
        created_at: '2025-06-01T10:00:00.000Z',
        updated_at: '2025-07-01T10:00:00.000Z',
        read_time: '8 min read',
        comment_count: 0,
        views_count: 1,
        tags: ['rust'],
        pinned: false,
        banner_url: null
    }
];

beforeEach(() => {
    (page as unknown as { url: URL }).url = new URL('https://example.com/blog');
    (page as { data: unknown }).data = {
        author: { name: 'Ada', username: 'ada', siteUrl: 'https://example.com', avatar: '' }
    };
    globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
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

test('lists, searches and sorts the published posts', async () => {
    mounted.push(
        mount(BlogIndexPage, { target: document.body, props: { data: { posts } } as never })
    );
    await settle();
    expect(document.body.textContent).toContain('Alpha notes');
    expect(document.body.textContent).toContain('Showing 2 of 2 articles');

    const search = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[name="q"]'
    );
    if (search) {
        search.value = 'alpha';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        await settle();
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        await settle();
    }

    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 6)) {
        button.click();
        flushSync();
    }
    await settle();
    expect(document.body.textContent).toContain('Alpha notes');
}, 60000);
