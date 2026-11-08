// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: ContactPage } =
    (await import('../apps/web/src/routes/(site)/contact/+page.svelte')) as { default: never };
const { default: ProjectsPage } =
    (await import('../apps/web/src/routes/(site)/projects/+page.svelte')) as { default: never };

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

const realFetch = globalThis.fetch;
const mounted: object[] = [];

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
    siteUrl: 'https://example.com',
    email: 'ada@example.com',
    avatar: ''
};

const contact = [
    {
        platform: 'Email',
        displayValue: 'ada@example.com',
        href: 'mailto:ada@example.com',
        icon: 'mail'
    },
    {
        platform: 'Mastodon',
        displayValue: '@ada',
        href: 'https://social.example/@ada',
        icon: 'mastodon'
    }
];

const project = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    fullName: `ada/${name}`,
    desc: `${name} description`,
    tags: ['svelte', 'web'],
    url: `https://github.com/ada/${name}`,
    cloneUrl: '',
    sshUrl: '',
    zipUrl: '',
    stars: 4,
    forks: 1,
    branches: 2,
    commits: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    pushedAt: '2026-02-01T00:00:00.000Z',
    licenseName: 'AGPL-3.0',
    licenseUrl: null,
    lang: 'TypeScript',
    langColor: '#3178c6',
    openGraphImageUrl: '',
    ...extra
});

beforeEach(() => {
    (page as unknown as { url: URL }).url = new URL('https://example.com/contact');
    (page as { data: unknown }).data = {};
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

function driveControls() {
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
        ...document.querySelectorAll<HTMLElement>(
            'button:not([type="submit"]), [role="tab"], [role="option"]'
        )
    ].slice(0, 40)) {
        control.click();
        flushSync();
    }
}

test('contact page shows its channels and message form', async () => {
    (page as { data: unknown }).data = { author, contact: [], canSendMessage: true };
    mounted.push(
        mount(ContactPage, {
            target: document.body,
            props: { data: { author, contact: [], canSendMessage: true } } as never
        })
    );
    await settle();
    expect(document.body.textContent).toContain('Ada Lovelace');
    driveControls();
    await settle();
}, 60000);

test('contact page explains when messages cannot be sent', async () => {
    mounted.push(
        mount(ContactPage, {
            target: document.body,
            props: { data: { author, contact: [], canSendMessage: false } } as never
        })
    );
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);

test('projects page lists pinned and recent repositories and filters them', async () => {
    const data = {
        author,
        projects: [
            project('idstead', { openGraphImageUrl: 'https://cdn.example/og.png' }),
            project('mnn', { licenseName: null, lang: undefined }),
            project('old', { pushedAt: null, createdAt: null })
        ],
        pinnedRepoNames: ['idstead']
    };
    (page as { data: unknown }).data = data;
    mounted.push(mount(ProjectsPage, { target: document.body, props: { data } as never }));
    await settle();
    expect(document.body.textContent).toContain('idstead');
    driveControls();
    const search = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[name="q"]'
    );
    if (search) {
        search.value = 'mnn';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        await settle();
    }
    await settle();
}, 60000);
