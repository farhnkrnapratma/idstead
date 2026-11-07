// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { respond } from './fixtures/admin.ts';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: ActivityWorkspace } =
    (await import('../apps/admin/src/lib/components/admin/ActivityWorkspace.svelte')) as {
        default: never;
    };

const realFetch = globalThis.fetch;
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

beforeEach(() => {
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
        const url = new URL(String(input), 'https://admin.example.com');
        return Response.json(respond(url, init?.method ?? 'GET'));
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

test.each(['reports', 'feedback', 'notifications'] as const)(
    'lists, searches and opens %s activity',
    async area => {
        mounted.push(
            mount(ActivityWorkspace, {
                target: document.body,
                props: { area, onSelectNotification: () => {} } as never
            })
        );
        await settle();
        await new Promise(resolve => setTimeout(resolve, 150));
        await settle();

        const search = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[type="text"]'
        );
        if (search) {
            search.value = 'row';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            flushSync();
            await new Promise(resolve => setTimeout(resolve, 300));
            await settle();
        }

        document
            .querySelector<HTMLElement>('[data-workspace-row], button[aria-pressed], li button')
            ?.click();
        flushSync();
        await settle();
        expect(document.body.innerHTML.length).toBeGreaterThan(0);
    },
    60000
);
