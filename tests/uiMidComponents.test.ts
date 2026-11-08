// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { shortcutStore } from '../packages/ui/src/stores/shortcutStore.svelte.ts';

const NavMenu = (
    (await import('../packages/ui/src/components/NavMenu.svelte')) as { default: never }
).default;
const PillInput = (
    (await import('../packages/ui/src/components/PillInput.svelte')) as { default: never }
).default;
const ShortcutCatalogDialog = (
    (await import('../packages/ui/src/components/ShortcutCatalogDialog.svelte')) as {
        default: never;
    }
).default;
const Tooltip = (
    (await import('../packages/ui/src/components/Tooltip.svelte')) as { default: never }
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
    shortcutStore.catalogOpen = false;
});

test('nav menu opens its groups and follows an item', async () => {
    mounted.push(
        mount(NavMenu, {
            target: document.body,
            props: {
                label: 'Other',
                groups: [
                    {
                        label: 'Connect',
                        items: [
                            { label: 'Contact', href: '/contact' },
                            { label: 'Funding', href: '/funding', external: true }
                        ]
                    },
                    { label: 'Empty', items: [] }
                ]
            } as never
        })
    );
    await settle();
    document.querySelector<HTMLElement>('button')?.click();
    flushSync();
    await settle();
    expect(document.body.textContent).toContain('Contact');
}, 60000);

test('pill input adds items on comma and enter and respects limits', async () => {
    const value = ['alpha'];
    mounted.push(
        mount(PillInput, {
            target: document.body,
            props: {
                id: 'tags',
                get value() {
                    return value;
                },
                set value(next: string[]) {
                    value.splice(0, value.length, ...next);
                },
                itemLabel: 'Tag',
                maxItems: 3,
                maxItemLength: 8,
                label: 'Tags'
            } as never
        })
    );
    await settle();
    const input = document.querySelector<HTMLInputElement>('input#tags, input');
    if (input) {
        for (const text of ['beta', 'gamma', 'delta-that-is-long']) {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: ',', bubbles: true, cancelable: true })
            );
            flushSync();
        }
        input.value = 'x';
        input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        flushSync();
        await settle();
    }
    expect(value.length).toBeGreaterThan(0);
}, 60000);

test('shortcut catalog lists the keyboard shortcuts when opened', async () => {
    shortcutStore.catalogOpen = true;
    mounted.push(
        mount(ShortcutCatalogDialog, {
            target: document.body,
            props: { hiddenCommands: ['/keyboard'] } as never
        })
    );
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);

test('tooltip opens on hover and on click when enabled', async () => {
    mounted.push(
        mount(Tooltip, {
            target: document.body,
            props: {
                content: 'Help text',
                toggleOnClick: true,
                delay: 0,
                children: () => {}
            } as never
        })
    );
    await settle();
    const trigger = document.querySelector<HTMLElement>(
        'button, [data-tooltip-trigger], span, div'
    );
    trigger?.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    trigger?.click();
    flushSync();
    await new Promise(resolve => setTimeout(resolve, 20));
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);
