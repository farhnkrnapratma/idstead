// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const HeadingActions = (
    (await import('../apps/web/src/lib/article/HeadingActions.svelte')) as { default: never }
).default;

const mounted: object[] = [];
const copied: string[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const props = (extra: Record<string, unknown> = {}) => ({
    href: '#intro',
    url: 'https://example.com/blog/hello#intro',
    title: 'Intro [draft]',
    qrSlug: 'hello',
    scope: 'page',
    ...extra
});

beforeEach(() => {
    copied.length = 0;
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                copied.push(text);
            }
        }
    });
});

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('the permalink follows the anchor and reports it to the page', async () => {
    let asked = 0;
    mounted.push(
        mount(HeadingActions, {
            target: document.body,
            props: props({ onPermalink: () => asked++ }) as never
        })
    );
    await settle();
    document.querySelector<HTMLAnchorElement>('a[aria-label="Permanent link"]')?.click();
    flushSync();
    expect(asked).toBe(1);
});

test('an active permalink clears itself when clicked again', async () => {
    mounted.push(
        mount(HeadingActions, { target: document.body, props: props({ active: true }) as never })
    );
    await settle();
    const anchor = document.querySelector<HTMLAnchorElement>('a[aria-label="Permanent link"]');
    if (!anchor) throw new Error('permalink missing');
    expect(anchor.classList.contains('mdrs-is-active')).toBe(true);
    anchor.click();
    flushSync();
    expect(anchor.classList.contains('mdrs-is-active')).toBe(false);
});
