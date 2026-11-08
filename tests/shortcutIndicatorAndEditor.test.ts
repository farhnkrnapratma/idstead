// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { shortcutStore } from '../packages/ui/src/stores/shortcutStore.svelte.ts';
import { EditorPreferences } from '../packages/mdrs/editor/src/preferences.svelte.ts';

const ShortcutModeIndicator = (
    (await import('../packages/ui/src/components/ShortcutModeIndicator.svelte')) as {
        default: never;
    }
).default;
const EditorCodeArea = (
    (await import('../packages/mdrs/editor/src/EditorCodeArea.svelte')) as { default: never }
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

test('shortcut mode indicator shows while a chord group is armed', async () => {
    mounted.push(mount(ShortcutModeIndicator, { target: document.body, props: {} as never }));
    await settle();
    shortcutStore.armGroup('args');
    await settle();
    expect(document.body.textContent).toBeDefined();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
}, 60000);

test('editor code area takes input and reports cursor and blur', async () => {
    const preferences = new EditorPreferences();
    const value = { current: '# Title\n\nBody' };
    mounted.push(
        mount(EditorCodeArea, {
            target: document.body,
            props: {
                get value() {
                    return value.current;
                },
                set value(next: string) {
                    value.current = next;
                },
                preferences,
                theme: 'light',
                placeholder: 'Write here',
                minHeight: '10rem',
                onblur: () => {}
            } as never
        })
    );
    await settle();
    const area = document.querySelector<HTMLTextAreaElement>('textarea');
    if (area) {
        area.value = '# Changed';
        area.selectionStart = 2;
        area.selectionEnd = 2;
        area.dispatchEvent(new Event('input', { bubbles: true }));
        area.dispatchEvent(new Event('select', { bubbles: true }));
        area.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        );
        area.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
        area.dispatchEvent(new Event('blur', { bubbles: true }));
        flushSync();
        await settle();
    }
    expect(preferences.ready).toBe(false);
}, 60000);
