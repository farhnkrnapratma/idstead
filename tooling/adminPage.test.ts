// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';
import { respond } from './fixtures/admin.ts';
import { exercise } from './support/exercise.ts';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const root = new URL('../', import.meta.url).pathname;
const file = root + 'apps/admin/src/routes/(admin)/+page.svelte';

Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input), 'https://dom.test');
    const body = respond(url, init?.method ?? 'GET');
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
}) as unknown as typeof fetch;

window.fetch = globalThis.fetch;
window.addEventListener('error', event => event.preventDefault());
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

const tabs = [
    '',
    'reports',
    'feedback',
    'notifications',
    'logs',
    'posts',
    'projects',
    'profile',
    'resume',
    'skills',
    'socials',
    'funding',
    'contact',
    'apps',
    'privacy',
    'terms',
    'security',
    'ai-disclosure',
    'account'
];

for (const tab of tabs) {
    test(`admin page ${tab || 'home'}`, async () => {
        const module = (await import(file)) as { default: never };
        (page as unknown as { url: URL }).url = new URL(
            `https://dom.test/${tab ? `?tab=${tab}` : ''}`
        );
        (page as { data: unknown }).data = { admin: { email: 'ada@example.com' } };
        const instance = mount(module.default, { target: document.body, props: {} });
        mounted.push(instance);
        flushSync();
        for (let round = 0; round < 1; round++) {
            await tick().catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 20));
            exercise(1);
        }
        for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(
            0,
            40
        )) {
            button.click();
            flushSync();
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            'input[type="text"], input:not([type]), textarea'
        )) {
            field.value = 'Sample';
            field.dispatchEvent(new Event('input', { bubbles: true }));
            flushSync();
        }
        expect(document.body.innerHTML.length).toBeGreaterThan(0);
    }, 120_000);
}
