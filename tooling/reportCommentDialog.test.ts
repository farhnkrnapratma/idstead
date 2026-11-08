// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({
    PUBLIC_API_BASE_URL: 'https://api.example.com',
    PUBLIC_TURNSTILE_SITE_KEY: ''
}));

const ReportCommentDialog = (
    (await import('../apps/web/src/lib/components/ReportCommentDialog.svelte')) as {
        default: never;
    }
).default;

const realFetch = globalThis.fetch;
const requests: Array<{ url: string; body: string }> = [];
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        element => element.textContent?.trim() === label
    );

beforeEach(() => {
    requests.length = 0;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        requests.push({ url: String(url), body: String(init?.body) });
        return Response.json({ message: 'Thanks.' }, { status: 200 });
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

test('reports a comment with the chosen reason and closes', async () => {
    let closed = 0;
    let open = true;
    mounted.push(
        mount(ReportCommentDialog, {
            target: document.body,
            props: {
                get isOpen() {
                    return open;
                },
                set isOpen(value: boolean) {
                    open = value;
                },
                comment: { id: 'c1', author_name: 'Reader', content: 'Hello' },
                onClose: () => closed++
            } as never
        })
    );
    await settle();
    const details = document.querySelector<HTMLTextAreaElement>('textarea');
    if (details) {
        details.value = 'It is spam.';
        details.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
    }
    button('Submit report')?.click();
    await settle();
    await new Promise(resolve => setTimeout(resolve, 20));
    await settle();
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe('/api/internal/blog/comments/report');
    expect(JSON.parse(requests[0].body)).toMatchObject({
        commentId: 'c1',
        reason: 'spam',
        details: 'It is spam.'
    });
    expect(closed).toBeGreaterThanOrEqual(1);
});

test('cancel closes without sending a report', async () => {
    let closed = 0;
    mounted.push(
        mount(ReportCommentDialog, {
            target: document.body,
            props: {
                isOpen: true,
                comment: { id: 'c2', content: 'Hi' },
                onClose: () => closed++
            } as never
        })
    );
    await settle();
    button('Cancel')?.click();
    await settle();
    expect(requests.length).toBe(0);
    expect(closed).toBe(1);
});
