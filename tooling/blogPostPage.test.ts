// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page, navigating } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: BlogPostPage } =
    (await import('../apps/web/src/routes/blog/[slug]/+page.svelte')) as { default: never };

const realFetch = globalThis.fetch;
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const post = {
    id: 'post-1',
    slug: 'hello',
    title: 'Hello world',
    excerpt: 'An excerpt for the post',
    created_at: '2026-01-02T10:00:00.000Z',
    updated_at: '2026-02-03T10:00:00.000Z',
    read_time: '4 min read',
    tags: ['svelte', 'tests'],
    collaborators: ['bob'],
    banner_version: 'b1',
    pinned: false,
    comment_count: 1,
    views_count: 12,
    helpful_yes: 3,
    helpful_no: 1,
    content_license: null,
    banner_url: null,
    banner_credit: null
};

const data = {
    post,
    bannerPublicUrl: '',
    license: { name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    bannerCredit: null,
    html: '<h2 id="intro">Intro</h2><p>Body text.</p><pre><code class="language-js">const x = 1;</code></pre>',
    headings: [{ id: 'intro', text: 'Intro', level: 2 }],
    comments: [
        {
            id: 'c1',
            parent_id: null,
            author_name: 'Reader',
            content: 'Nice post',
            is_anonymous: false,
            is_admin: false,
            is_approved: true,
            created_at: '2026-01-05T10:00:00.000Z'
        }
    ],
    relatedPosts: [
        {
            id: 'post-2',
            title: 'Earlier post',
            slug: 'earlier',
            excerpt: 'Before',
            created_at: '2025-12-01T10:00:00.000Z',
            updated_at: null,
            read_time: '2 min read',
            comment_count: 0,
            views_count: 3,
            tags: ['svelte'],
            pinned: false
        }
    ],
    author: {
        name: 'Ada Lovelace',
        username: 'ada',
        siteUrl: 'https://example.com',
        avatar: '',
        avatarVersion: 'a1',
        headline: 'Engineer',
        email: 'ada@example.com'
    },
    initialViewsCount: 12,
    newsletterEnabled: true,
    cookieConsent: true
};

beforeEach(() => {
    (page as unknown as { url: URL }).url = new URL('https://example.com/blog/hello');
    (page as unknown as { params: Record<string, string> }).params = { slug: 'hello' };
    (page as { data: unknown }).data = data;
    (navigating as { to: unknown }).to = null;
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

test('renders a post with its comments, related posts and dialogs', async () => {
    const instance = mount(BlogPostPage, { target: document.body, props: { data } as never });
    mounted.push(instance);
    await settle();
    expect(document.body.textContent).toContain('Authored by ada and bob');
    expect(document.body.textContent).toContain('Nice post');
    expect(document.body.textContent).toContain('Earlier post');
    for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea'
    )) {
        if (
            field instanceof HTMLInputElement
            && (field.type === 'checkbox' || field.type === 'radio')
        )
            continue;
        field.value = field.name === 'email' ? 'reader@example.com' : 'Sample text';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        flushSync();
    }
    for (const control of [
        ...document.querySelectorAll<HTMLElement>('button, [role="tab"], [role="option"]')
    ].slice(0, 40)) {
        control.click();
        flushSync();
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    await settle();
}, 60000);
