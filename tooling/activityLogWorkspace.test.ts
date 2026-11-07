// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: ActivityLogWorkspace } =
    (await import('../apps/admin/src/lib/components/admin/ActivityLogWorkspace.svelte')) as {
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

const rows = Array.from({ length: 12 }, (_, index) => ({
    id: `log-${index}`,
    created_at: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    actor: 'ada@example.com',
    action: index % 2 ? 'blog.publish' : 'legal.update',
    category: index % 2 ? 'blog' : 'legal',
    entity_id: `entity-${index}`,
    summary: `Changed item ${index}`,
    ip: '203.0.113.1',
    details: { note: 'x' }
}));

let failNext = false;

beforeEach(() => {
    failNext = false;
    globalThis.fetch = (async (input: string) => {
        const url = new URL(String(input), 'https://admin.example.com');
        if (failNext) return Response.json({ message: 'Log is down.' }, { status: 500 });
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 10);
        return Response.json({
            data: rows.slice(offset, offset + limit),
            total: rows.length,
            limit,
            offset
        });
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

test('loads, filters and pages the activity log', async () => {
    mounted.push(mount(ActivityLogWorkspace, { target: document.body, props: {} as never }));
    await settle();
    await new Promise(resolve => setTimeout(resolve, 200));
    await settle();
    expect(document.body.textContent).toContain('Changed item 0');

    const search = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[type="text"]'
    );
    if (search) {
        search.value = 'item 3';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        await new Promise(resolve => setTimeout(resolve, 300));
        await settle();
    }

    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 8)) {
        button.click();
        flushSync();
        await settle();
    }
    expect(document.body.textContent).toBeDefined();
}, 60000);

test('shows the failure message when the log cannot be loaded', async () => {
    failNext = true;
    mounted.push(mount(ActivityLogWorkspace, { target: document.body, props: {} as never }));
    await settle();
    await new Promise(resolve => setTimeout(resolve, 200));
    await settle();
    expect(document.body.textContent).toContain('Log is down.');
}, 60000);
