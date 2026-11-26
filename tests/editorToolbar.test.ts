// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';
import EditorToolbar from '../packages/mdrs/editor/src/EditorToolbar.svelte';
import EditorViewBar from '../packages/mdrs/editor/src/EditorViewBar.svelte';
import { EditorPreferences } from '../packages/mdrs/editor/src/preferences.svelte';

function setup<T extends Record<string, unknown>>(component: never, props: T) {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(component, { target, props });
    flushSync();
    return {
        target,
        done: () => {
            unmount(instance);
            target.remove();
        }
    };
}

function menuItems() {
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

test('every toolbar button and menu item sends its edit', () => {
    const calls: unknown[][] = [];
    const record =
        (name: string) =>
        (...args: unknown[]) =>
            calls.push([name, ...args]);
    const { target, done } = setup(EditorToolbar as never, {
        insert: record('insert'),
        prefixLines: record('prefixLines'),
        insertBlock: record('insertBlock'),
        insertDefine: record('insertDefine'),
        insertVerbatim: record('insertVerbatim')
    });

    const buttons = [...target.querySelectorAll<HTMLButtonElement>('button[aria-label]')];
    const triggers = buttons.filter(button => button.getAttribute('aria-haspopup') === 'menu');
    for (const button of buttons.filter(button => !triggers.includes(button))) {
        button.click();
        flushSync();
    }
    const menuCounts: number[] = [];
    for (const trigger of triggers) {
        trigger.click();
        flushSync();
        const count = menuItems().length;
        menuCounts.push(count);
        for (let index = 0; index < count; index++) {
            if (!menuItems().length) {
                trigger.click();
                flushSync();
            }
            menuItems()[index].click();
            flushSync();
        }
    }

    expect(menuCounts).toEqual([3, 4, 18]);
    expect(calls.length).toBe(buttons.length - triggers.length + 3 + 4 + 18);
    expect(calls).toContainEqual(['prefixLines', '# ']);
    expect(calls).toContainEqual(['prefixLines', '#### ']);
    expect(calls).toContainEqual(['insert', '**', '**']);
    expect(calls).toContainEqual(['insert', '<mark>', '</mark>']);
    expect(calls).toContainEqual(['insert', '![', '](url)']);
    expect(calls).toContainEqual(['insertBlock', ':::note\n', '\n:::']);
    expect(calls).toContainEqual(['insertBlock', '```\n', '\n```']);
    expect(calls).toContainEqual(['insertDefine']);
    expect(calls).toContainEqual(['insertVerbatim']);
    done();
});

test('the view menu changes wrapping, line numbers and indentation', () => {
    const preferences = new EditorPreferences();
    const { target, done } = setup(EditorViewBar as never, { preferences });
    target.querySelector<HTMLButtonElement>('button[aria-label="View options"]')?.click();
    flushSync();
    const checkboxes = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const wrapBefore = preferences.lineWrapMode;
    const numbersBefore = preferences.showLineNumbers;
    for (const checkbox of checkboxes) {
        checkbox.click();
        flushSync();
    }
    expect(preferences.lineWrapMode).not.toBe(wrapBefore);
    expect(preferences.showLineNumbers).toBe(!numbersBefore);

    const radio = (label: string) =>
        [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
            button => button.textContent?.trim() === label
        );
    radio('Tabs')?.click();
    flushSync();
    expect(preferences.indentMode).toBe('tabs');
    radio('Tabs')?.click();
    flushSync();
    expect(preferences.indentMode).toBe('tabs');
    radio('Spaces')?.click();
    radio('2')?.click();
    flushSync();
    expect(preferences.indentMode).toBe('spaces');
    expect(preferences.indentSize).toBe(2);
    done();
});
