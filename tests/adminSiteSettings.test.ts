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

test('a failed load shows the error and retries until the form loads', async () => {
    for (const [component, payload, title] of [
        [ContentLicenseSettings, { contentLicense: { license: 'CC0-1.0' } }, 'content license'],
        [AnalyticsSettings, { analytics: { provider: 'none' } }, 'analytics settings']
    ] as const) {
        let failing = true;
        globalThis.fetch = (async () =>
            failing
                ? new Response(JSON.stringify({ error: { message: 'Database unavailable' } }), {
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                  })
                : new Response(JSON.stringify(payload), {
                      headers: { 'Content-Type': 'application/json' }
                  })) as unknown as typeof fetch;
        mounted.push(mount(component as never, { target: document.body }));
        await settle();
        expect(document.body.textContent).toContain(`Couldn't load the ${title}`);
        expect(document.body.textContent).toContain('Database unavailable');
        failing = false;
        [...document.querySelectorAll('button')]
            .find(b => /try again/i.test(b.textContent ?? ''))
            ?.click();
        await settle();
        expect(document.body.textContent).not.toContain(`Couldn't load the ${title}`);
        expect(document.querySelector('button[type="submit"]')).not.toBeNull();
        for (const instance of mounted.splice(0)) void unmount(instance);
        document.body.innerHTML = '';
    }
});

test('content license loads, then saves from the right-aligned action row', async () => {
    serve({ contentLicense: { license: 'CC-BY-4.0' } });
    await saveFrom(ContentLicenseSettings);
    expect(posts).toEqual([
        { url: '/api/internal/admin/site-settings/content-license', body: { license: 'CC-BY-4.0' } }
    ]);
});

function pick(id: string, label: string) {
    document.querySelector<HTMLButtonElement>(`#${id}`)?.click();
    flushSync();
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find(option => option.textContent?.trim().startsWith(label))
        ?.click();
    flushSync();
}

async function submitWith(response: () => Response) {
    const load = globalThis.fetch;
    globalThis.fetch = (async (input: string, init?: RequestInit) =>
        init?.method === 'POST' ? response() : load(input, init)) as typeof fetch;
    document.querySelector('form')?.requestSubmit();
    await settle();
}

test('changing a setting and failing to save shows the reason in the form', async () => {
    for (const [component, payload, id, option, text] of [
        [
            ContentLicenseSettings,
            { contentLicense: { license: 'CC-BY-4.0' } },
            'content-license',
            'CC0',
            'may reuse'
        ],
        [
            AnalyticsSettings,
            { analytics: { provider: 'none' } },
            'analytics-provider',
            'Google Analytics 4',
            'sets cookies'
        ]
    ] as const) {
        serve(payload);
        mounted.push(mount(component as never, { target: document.body }));
        await settle();
        pick(id, option);
        expect(document.body.textContent).toContain(text);

        await submitWith(
            () =>
                new Response(JSON.stringify({ error: { message: 'Rejected by the server' } }), {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' }
                })
        );
        expect(document.body.textContent).toContain('Rejected by the server');

        await submitWith(() => {
            throw new Error('Network down');
        });
        expect(document.body.textContent).toContain('Network down');

        for (const instance of mounted.splice(0)) void unmount(instance);
        document.body.innerHTML = '';
    }
});
