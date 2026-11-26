// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const AnalyticsSettings = (
    (await import('../apps/admin/src/lib/components/admin/AnalyticsSettings.svelte')) as {
        default: never;
    }
).default;
const ContentLicenseSettings = (
    (await import('../apps/admin/src/lib/components/admin/ContentLicenseSettings.svelte')) as {
        default: never;
    }
).default;

const realFetch = globalThis.fetch;
const mounted: object[] = [];
const posts: { url: string; body: unknown }[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
    globalThis.fetch = realFetch;
    posts.length = 0;
});

function serve(payload: Record<string, unknown>) {
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
        if (init?.method === 'POST')
            posts.push({ url: input, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' }
        });
    }) as typeof fetch;
}

async function saveFrom(component: never) {
    mounted.push(mount(component, { target: document.body }));
    await settle();
    const save = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(save?.textContent?.trim()).toBe('Save');
    expect(save?.parentElement?.className).toContain('sm:justify-end');
    save?.closest('form')?.requestSubmit();
    await settle();
}

test('analytics settings load, then save from the right-aligned action row', async () => {
    serve({ analytics: { provider: 'umami', websiteId: 'site-1', scriptUrl: '' } });
    await saveFrom(AnalyticsSettings);
    expect(posts).toEqual([
        {
            url: '/api/internal/admin/site-settings/analytics',
            body: { provider: 'umami', websiteId: 'site-1', scriptUrl: '' }
        }
    ]);
});

test('content license loads, then saves from the right-aligned action row', async () => {
    serve({ contentLicense: { license: 'CC-BY-4.0' } });
    await saveFrom(ContentLicenseSettings);
    expect(posts).toEqual([
        { url: '/api/internal/admin/site-settings/content-license', body: { license: 'CC-BY-4.0' } }
    ]);
});
