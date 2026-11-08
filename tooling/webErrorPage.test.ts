// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: ErrorPage } = (await import('../apps/web/src/routes/+error.svelte')) as {
    default: never;
};

const mounted: object[] = [];

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
});

const cases: Array<[number, string]> = [
    [400, 'Bad request'],
    [401, 'Authentication required'],
    [403, 'Access denied'],
    [404, 'Page not found'],
    [408, 'Request timed out'],
    [429, 'Too many requests'],
    [500, 'Something went wrong'],
    [502, 'Bad gateway'],
    [503, 'Service unavailable'],
    [504, 'Gateway timeout']
];

for (const [status, title] of cases) {
    test(`shows the ${status} page with its title`, async () => {
        (page as unknown as { status: number }).status = status;
        (page as unknown as { error: unknown }).error = null;
        mounted.push(mount(ErrorPage, { target: document.body, props: {} as never }));
        await settle();
        expect(document.body.textContent).toContain(title);
        document.body.innerHTML = '';
    });
}

test('falls back to the error message for other statuses', async () => {
    (page as unknown as { status: number }).status = 418;
    (page as unknown as { error: unknown }).error = { message: 'Teapot offline.' };
    mounted.push(mount(ErrorPage, { target: document.body, props: {} as never }));
    await settle();
    expect(document.body.textContent).toContain('An error occurred');
    expect(document.body.textContent).toContain('Teapot offline.');
});

test('uses the generic description when no error message exists', async () => {
    (page as unknown as { status: number }).status = 418;
    (page as unknown as { error: unknown }).error = null;
    mounted.push(mount(ErrorPage, { target: document.body, props: {} as never }));
    await settle();
    expect(document.body.textContent).toContain('Something went wrong on our end.');
});
