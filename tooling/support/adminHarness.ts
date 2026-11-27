// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, mock, setDefaultTimeout } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';
import { toastStore } from '../../packages/ui/src/stores/toastStore.svelte.ts';
import { installIndexedDB } from '../../tests/support/fakeIndexedDB.ts';
import { respond } from '../fixtures/admin.ts';

installIndexedDB();

setDefaultTimeout(60_000);

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

type Reply = unknown | Response;
type Handler = (url: URL, init: RequestInit) => Reply | Promise<Reply>;

interface Call {
    method: string;
    path: string;
    body: unknown;
}

const root = new URL('../../', import.meta.url).pathname;
const overrides = new Map<string, Handler>();
const mounted: object[] = [];
const calls: Call[] = [];

Element.prototype.animate = () =>
    ({
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    }) as unknown as Animation;

function bodyOf(init: RequestInit) {
    if (typeof init.body !== 'string') return init.body ?? null;
    try {
        return JSON.parse(init.body);
    } catch {
        return init.body;
    }
}

globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const url = new URL(String(input), 'https://dom.test');
    const method = init.method ?? 'GET';
    const path = url.pathname.replace('/api/internal/admin/', '');
    calls.push({ method, path, body: bodyOf(init) });
    const handler = overrides.get(`${method} ${path}`) ?? overrides.get(path);
    const reply = handler ? await handler(url, init) : respond(url, method);
    if (reply instanceof Response) return reply;
    return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
}) as unknown as typeof fetch;
window.fetch = globalThis.fetch;

export function route(key: string, handler: Handler) {
    overrides.set(key, handler);
}

export function failure(message: string, status = 422) {
    return new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

export async function settle(rounds = 6) {
    for (let round = 0; round < rounds; round++) {
        await tick().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
}

export async function openAdmin(search = '') {
    const module = (await import(`${root}apps/admin/src/routes/(admin)/+page.svelte`)) as {
        default: never;
    };
    (page as unknown as { url: URL }).url = new URL(`https://dom.test/${search}`);
    (page as { data: unknown }).data = { admin: { email: 'ada@example.com' } };
    mounted.push(mount(module.default, { target: document.body, props: {} }));
    await settle(10);
    const started = Date.now();
    while (/Loading dashboard/.test(text()) && Date.now() - started < 3000) {
        await new Promise(resolve => setTimeout(resolve, 20));
        await settle(2);
    }
}

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
    overrides.clear();
    calls.length = 0;
});

function label(element: Element) {
    return (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
}

export function buttons(name: string | RegExp, scope: ParentNode = document) {
    return [...scope.querySelectorAll<HTMLElement>('button, [role="menuitem"]')].filter(element =>
        typeof name === 'string' ? label(element) === name : name.test(label(element))
    );
}

function button(name: string | RegExp, scope: ParentNode = document) {
    const [found] = buttons(name, scope);
    if (!found) throw new Error(`No button named ${name}`);
    return found;
}

export async function click(name: string | RegExp, scope: ParentNode = document) {
    button(name, scope).click();
    await settle();
}

export async function menu(trigger: string, item: string) {
    await click(trigger);
    await click(item);
}

export async function confirmDialog(name: string | RegExp) {
    const dialog = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].at(-1);
    if (!dialog) throw new Error('No dialog open');
    const phrase = dialog.querySelector<HTMLInputElement>('input');
    if (phrase) await type(phrase, 'DELETE');
    await click(name, dialog);
}

export async function chooseFile(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
}

export async function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(2);
}

export function text() {
    return document.body.textContent ?? '';
}

export function toast() {
    return { message: toastStore.message, type: toastStore.type };
}

export function sent(method: string, path: string) {
    return calls.filter(call => call.method === method && call.path === path);
}
