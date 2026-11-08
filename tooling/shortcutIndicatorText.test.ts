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

const ShortcutModeIndicator = (
    (await import('../packages/ui/src/components/ShortcutModeIndicator.svelte')) as {
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
    document.body.innerHTML = '';
    shortcutStore.disarm();
});

test('names the chord group while it waits for a badge key', async () => {
    const member = document.createElement('button');
    document.body.append(member);
    const handle = shortcut(member, { group: 'args', chordKey: 'x', label: 'Grouped' } as never);
    mounted.push(mount(ShortcutModeIndicator, { target: document.body, props: {} as never }));
    await settle();
    expect(document.body.textContent).not.toContain('Press the key shown on a badge.');
    shortcutStore.armGroup('args');
    await settle();
    expect(document.body.textContent).toContain('Press the key shown on a badge.');
    expect(document.body.textContent).toContain('to cancel');
    expect(document.body.textContent).not.toContain('for all shortcuts');
    handle.destroy();
});

test('offers the shortcut catalog while the leader key waits for an action', async () => {
    mounted.push(mount(ShortcutModeIndicator, { target: document.body, props: {} as never }));
    await settle();
    shortcutStore.disarm();
    window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, bubbles: true })
    );
    await settle();
    expect(document.body.textContent).toContain('Shortcut mode');
    expect(document.body.textContent).toContain('Press the key shown on a button.');
    expect(document.body.textContent).toContain('for all shortcuts');
});
