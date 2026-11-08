// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));
Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};

const TableOfContents = (
    (await import('../apps/web/src/lib/components/TableOfContents.svelte')) as { default: never }
).default;

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

const headings = [
    { id: 'intro', text: 'Intro', level: 2 },
    { id: 'setup', text: 'Setup', level: 3 },
    { id: 'usage', text: 'Usage', level: 2 }
];

test('lists every heading at its depth under the table of contents title', async () => {
    mounted.push(mount(TableOfContents, { target: document.body, props: { headings } as never }));
    await settle();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Table of contents');
    for (const heading of headings) expect(text).toContain(heading.text);
});

test('collapses and expands when the list is collapsible', async () => {
    mounted.push(
        mount(TableOfContents, {
            target: document.body,
            props: { headings, collapsible: true, defaultCollapsed: true } as never
        })
    );
    await settle();
    const toggle = document.querySelector<HTMLButtonElement>('button');
    if (!toggle) throw new Error('toggle missing');
    toggle.click();
    await settle();
    toggle.click();
    await settle();
    expect(document.body.textContent).toContain('Intro');
});
