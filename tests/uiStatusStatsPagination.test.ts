// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const StatusBadge = (
    (await import('../packages/ui/src/components/StatusBadge.svelte')) as { default: never }
).default;
const StatsGrid = (
    (await import('../packages/ui/src/components/StatsGrid.svelte')) as { default: never }
).default;
const Pagination = (
    (await import('../packages/ui/src/components/Pagination.svelte')) as { default: never }
).default;

const realFetch = globalThis.fetch;
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
    for (const script of document.querySelectorAll('script[src*="instatus"]')) script.remove();
});

test('status badge ignores hosts that are not instatus pages', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
        calls++;
        return Response.json({});
    }) as unknown as typeof fetch;
    mounted.push(mount(StatusBadge, { target: document.body, props: { host: 'example.com' } }));
    await settle();
    expect(calls).toBe(0);
    expect(document.querySelector('a')).toBeNull();
});

test('status badge links to a status page with its reported state', async () => {
    globalThis.fetch = (async () =>
        Response.json({ page: { status: 'UP' } })) as unknown as typeof fetch;
    mounted.push(
        mount(StatusBadge, {
            target: document.body,
            props: { host: 'status-page.instatus.com', code: 'abc123' }
        })
    );
    await settle();
    const link = document.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://status-page.instatus.com');
    expect(link?.getAttribute('title')).toBeTruthy();
    expect(document.querySelector('script[src*="abc123"]')).not.toBeNull();
});

test('status badge shows an unknown state when the summary request fails', async () => {
    globalThis.fetch = (async () => {
        throw new Error('offline');
    }) as unknown as typeof fetch;
    mounted.push(
        mount(StatusBadge, { target: document.body, props: { host: 'status-page.instatus.com' } })
    );
    await settle();
    expect(document.querySelector('a')).not.toBeNull();
});

test('stats grid renders each variant with optional actions and ratios', async () => {
    let clicks = 0;
    const stats = [
        { label: 'Views', value: '12', description: 'Total', ratio: 0.4 },
        { label: 'Posts', value: '3', onclick: () => clicks++ },
        { label: 'Links', value: '7', icon: 'link' }
    ];
    for (const props of [
        { stats, variant: 'default', columns: 4 },
        { stats, variant: 'compact', columns: 5 },
        { stats, variant: 'funding', columns: 4, class: 'extra' }
    ]) {
        mounted.push(mount(StatsGrid, { target: document.body, props: props as never }));
        await settle();
    }
    expect(document.querySelectorAll('[role="group"]').length).toBeGreaterThan(0);
    const actions = [...document.querySelectorAll<HTMLButtonElement>('button')];
    for (const action of actions) action.click();
    flushSync();
    expect(clicks).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Views');
});

test('pagination moves between pages and clamps at the edges', async () => {
    const changes: number[] = [];
    mounted.push(
        mount(Pagination, {
            target: document.body,
            props: {
                page: 5,
                totalPages: 10,
                onPageChange: (next: number) => changes.push(next)
            } as never
        })
    );
    await settle();
    document.querySelector<HTMLButtonElement>('[aria-label="First page"]')?.click();
    document.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')?.click();
    flushSync();
    expect(changes).toEqual([1, 4]);
    expect(document.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination');
});

test('compact pagination without jump controls still lets the reader step', async () => {
    const changes: number[] = [];
    mounted.push(
        mount(Pagination, {
            target: document.body,
            props: {
                page: 1,
                totalPages: 3,
                size: 'sm',
                onPageChange: (next: number) => changes.push(next)
            } as never
        })
    );
    await settle();
    expect(document.querySelector('[aria-label="First page"]')).toBeNull();
    const previous = document.querySelector<HTMLButtonElement>('[aria-label="Previous page"]');
    expect(previous?.disabled).toBe(true);
    expect(changes).toEqual([]);
});
