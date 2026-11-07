// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';
import { spotlightStore } from '../apps/web/src/lib/stores/spotlightStore.svelte.ts';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: SpotlightDialog } =
    (await import('../apps/web/src/lib/components/SpotlightDialog.svelte')) as { default: never };

const mounted: object[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

function type(value: string) {
    const input = document.querySelector<HTMLInputElement>('#spotlight-search-input');
    if (!input) throw new Error('search input missing');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
}

function press(key: string, target: Element | Document = document) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    flushSync();
}

function clickBy(selector: string) {
    document.querySelector<HTMLElement>(selector)?.click();
    flushSync();
}

beforeEach(() => {
    (page as unknown as { url: URL }).url = new URL('https://dom.test/blog/hello');
    (page as { data: unknown }).data = {
        post: { id: 'post-1', title: 'Hello' },
        author: { name: 'Ada', avatar: '' }
    };
    spotlightStore.setProjects([
        {
            name: 'idstead',
            desc: 'Personal site',
            url: 'https://example.com/idstead',
            tags: ['svelte', 'web', 'site', 'extra'],
            stars: 1,
            createdAt: null,
            pushedAt: null
        } as never,
        {
            name: 'mnn',
            desc: 'Notes',
            url: 'https://example.com/mnn',
            tags: [],
            stars: 0,
            createdAt: null,
            pushedAt: null
        } as never
    ]);
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

test('drives the open palette through search, options, keyboard and help', async () => {
    const instance = mount(SpotlightDialog, { target: document.body, props: {} });
    mounted.push(instance);
    flushSync();
    spotlightStore.open('');
    await settle();

    type('idstead');
    await new Promise(resolve => setTimeout(resolve, 400));
    await settle();
    await new Promise(resolve => setTimeout(resolve, 400));
    await settle();
    expect(document.body.textContent).toContain('idstead');

    clickBy('[aria-label="Toggle case sensitivity"]');
    clickBy('[aria-label="Toggle whole word search"]');
    clickBy('[aria-label="Toggle regular expression search"]');
    clickBy('[aria-label="Toggle regular expression search"]');
    await settle();

    type('/');
    await new Promise(resolve => setTimeout(resolve, 200));
    await settle();

    const input = document.querySelector<HTMLInputElement>('#spotlight-search-input')!;
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Enter']) {
        press(key, input);
    }
    await settle();

    type('mnn');
    await new Promise(resolve => setTimeout(resolve, 200));
    await settle();
    press('ArrowDown', input);
    press('Enter', input);
    await settle();

    spotlightStore.open('');
    await settle();
    type('/help');
    await new Promise(resolve => setTimeout(resolve, 400));
    await settle();
    press('Enter', input);
    await settle();
    const guide = document.querySelector<HTMLElement>('[aria-label="Reference guide"]');
    if (guide) {
        press('ArrowDown', guide);
        press('ArrowDown', guide);
        press('ArrowUp', guide);
        press('Enter', guide);
        await settle();
    }
    spotlightStore.open('');
    await settle();
    type('/help');
    await new Promise(resolve => setTimeout(resolve, 400));
    await settle();
    press('Enter', document.querySelector<HTMLInputElement>('#spotlight-search-input') ?? input);
    await settle();
    clickBy('[aria-label="Close guide"]');
    await settle();

    spotlightStore.open('');
    await settle();
    press('Escape', input);
    await settle();
});
