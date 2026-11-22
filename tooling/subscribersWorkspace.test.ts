// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: SubscribersWorkspace } = (await import(
    '../apps/admin/src/lib/components/admin/SubscribersWorkspace.svelte'
)) as { default: never };

const realFetch = globalThis.fetch;
const mounted: object[] = [];
const calls: { method: string; url: string; body: unknown }[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const subscriber = (n: number, status: string) => ({
    id: `0f8fad5b-d9cb-469f-a165-70867728950${n}`,
    email: `reader${n}@example.com`,
    status,
    created_at: '2026-11-01T00:00:00.000Z',
    confirmed_at: status === 'pending' ? null : '2026-11-02T00:00:00.000Z',
    unsubscribed_at: null
});

let items = [subscriber(1, 'active'), subscriber(2, 'pending'), subscriber(3, 'unsubscribed')];
let failList = false;
let failWrite = false;

beforeEach(() => {
    items = [subscriber(1, 'active'), subscriber(2, 'pending'), subscriber(3, 'unsubscribed')];
    failList = false;
    failWrite = false;
    calls.length = 0;
    globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET';
        calls.push({
            method,
            url: String(input),
            body: init.body ? JSON.parse(String(init.body)) : null
        });
        if (method === 'GET') {
            if (failList)
                return Response.json({ error: { message: 'List is down.' } }, { status: 503 });
            return Response.json({ items, total: items.length, page: 1, pageSize: 25 });
        }
        if (failWrite)
            return Response.json({ error: { message: 'Write failed.' } }, { status: 409 });
        return method === 'DELETE'
            ? new Response(null, { status: 204 })
            : Response.json({ ok: true });
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

async function render() {
    mounted.push(mount(SubscribersWorkspace, { target: document.body, props: {} as never }));
    await settle();
}

const buttons = (label: string) =>
    [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].filter(
        element =>
            element.textContent?.trim() === label || element.getAttribute('aria-label') === label
    );

async function click(label: string) {
    const [element] = buttons(label);
    expect(element).toBeDefined();
    element.click();
    flushSync();
    await settle();
}

test('lists subscribers with their status', async () => {
    await render();
    const text = document.body.textContent ?? '';
    for (const email of ['reader1@example.com', 'reader2@example.com', 'reader3@example.com'])
        expect(text).toContain(email);
    expect(text).toContain('Pending');
    expect(text).toContain('Unsubscribed');
});

test('shows the error and empty states', async () => {
    failList = true;
    await render();
    expect(document.body.textContent).toContain('List is down.');
    for (const instance of mounted.splice(0)) void unmount(instance);
    failList = false;
    items = [];
    await render();
    expect(document.body.textContent).toContain('No subscribers yet');
});

test('searches and filters through the API', async () => {
    await render();
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'reader2';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    await settle();
    expect(calls.at(-1)?.url).toContain('q=reader2');
});

test('adds a subscriber through the confirmation dialog', async () => {
    await render();
    await click('Add subscriber');
    await click('Send confirmation');
    expect(document.body.textContent).toContain('Enter an email address.');
    const input = document.querySelector<HTMLInputElement>('#subscriber-email')!;
    input.value = 'new@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await click('Send confirmation');
    expect(calls.find(call => call.method === 'POST')?.body).toEqual({ email: 'new@example.com' });
});

test('changes status, resends and deletes from the row menu', async () => {
    await render();
    await click('Actions for reader1@example.com');
    await click('Unsubscribe');
    expect(calls.find(call => call.method === 'PATCH')?.body).toEqual({ status: 'unsubscribed' });
    await click('Actions for reader2@example.com');
    await click('Resend confirmation');
    expect(calls.filter(call => call.method === 'PATCH').at(-1)?.body).toEqual({
        action: 'resend'
    });
    await click('Actions for reader3@example.com');
    await click('Reactivate');
    expect(calls.filter(call => call.method === 'PATCH').at(-1)?.body).toEqual({
        status: 'active'
    });
    await click('Actions for reader1@example.com');
    await click('Delete subscriber');
    expect(document.body.textContent).toContain('Delete this subscriber?');
    failWrite = true;
    const dialogButtons = () =>
        buttons('Delete subscriber').filter(button =>
            button.closest('[role="alertdialog"],[role="dialog"]')
        );
    dialogButtons()[0].click();
    await settle();
    expect(calls.some(call => call.method === 'DELETE')).toBe(true);
    failWrite = false;
    dialogButtons()[0].click();
    await settle();
    expect(calls.filter(call => call.method === 'DELETE')).toHaveLength(2);
});

test('offers a new confirmation instead of reactivating an unconfirmed address', async () => {
    items = [{ ...subscriber(4, 'unsubscribed'), confirmed_at: null }];
    await render();
    await click('Actions for reader4@example.com');
    expect(buttons('Reactivate')).toHaveLength(0);
    await click('Send confirmation');
    expect(calls.find(call => call.method === 'POST')?.body).toEqual({
        email: 'reader4@example.com'
    });
});
