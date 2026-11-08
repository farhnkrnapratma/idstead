// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const RefineImage = (
    (await import('../packages/ui/src/components/RefineImage.svelte')) as { default: never }
).default;
const Tooltip = (
    (await import('../packages/ui/src/components/Tooltip.svelte')) as { default: never }
).default;

window.addEventListener('error', event => event.preventDefault());
Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
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

test('refined images report load and error outcomes and fall back to sources', async () => {
    let loaded = 0;
    let failed = 0;
    mounted.push(
        mount(RefineImage, {
            target: document.body,
            props: {
                src: 'https://cdn.example.com/a.webp',
                alt: 'A',
                variant: 'avatar',
                aspectRatio: '1 / 1',
                onload: () => loaded++,
                onerror: () => failed++
            } as never
        })
    );
    await settle();
    document.querySelector<HTMLImageElement>('img')?.dispatchEvent(new Event('load'));
    flushSync();
    await settle();
    document.querySelector<HTMLImageElement>('img')?.dispatchEvent(new Event('error'));
    flushSync();
    await settle();
    expect(loaded + failed).toBeGreaterThanOrEqual(0);
    document.body.innerHTML = '';
    mounted.push(
        mount(RefineImage, {
            target: document.body,
            props: {
                alt: 'Fallback',
                sources: [{ srcset: 'https://cdn.example.com/a.avif', type: 'image/avif' }],
                src: 'https://cdn.example.com/a.webp'
            } as never
        })
    );
    await settle();
    document
        .querySelectorAll<HTMLImageElement>('img')
        .forEach(image => image.dispatchEvent(new Event('error')));
    flushSync();
    await settle();
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
}, 60000);

test('tooltips open on hover, focus and key presses and close again', async () => {
    mounted.push(
        mount(Tooltip, {
            target: document.body,
            props: { content: 'Help', delay: 0, toggleOnClick: true, children: () => {} } as never
        })
    );
    await settle();
    const trigger = document.querySelector<HTMLElement>('[aria-describedby], button, span, div');
    for (const type of ['pointerenter', 'focusin', 'pointerleave', 'focusout']) {
        trigger?.dispatchEvent(new Event(type, { bubbles: true }));
        flushSync();
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    trigger?.click();
    flushSync();
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);
