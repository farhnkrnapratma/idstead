// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const ShortcutCatalogDialog = (
    (await import('../packages/ui/src/components/ShortcutCatalogDialog.svelte')) as {
        default: never;
    }
).default;
const { shortcutStore } = await import('../packages/ui/src/stores/shortcutStore.svelte.ts');
const { shortcut } = await import('../packages/ui/src/utils/shortcut.svelte.ts');

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
    shortcutStore.catalogOpen = false;
    document.body.innerHTML = '';
});

test('lists the shortcut mode, the catalog key and each registered action', async () => {
    const member = document.createElement('button');
    member.setAttribute('aria-label', 'Frobnicate');
    document.body.append(member);
    const handle = shortcut(member, { combo: 'K', label: 'Frobnicate' } as never);
    mounted.push(mount(ShortcutCatalogDialog, { target: document.body, props: {} as never }));
    await settle();
    shortcutStore.catalogOpen = true;
    await settle();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Keyboard shortcuts');
    expect(text).toContain('Shortcut mode');
    expect(text).toContain('Open this list');
    expect(text).toContain('Frobnicate');
    handle.destroy();
});
