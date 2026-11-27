// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import EditorCodeArea from '../packages/mdrs/editor/src/EditorCodeArea.svelte';
import { EditorPreferences } from '../packages/mdrs/editor/src/preferences.svelte';

interface CodeArea {
    insert(prefix: string, suffix?: string): void;
    insertBlock(opening: string, closing?: string): void;
    insertVerbatim(): void;
    insertDefine(): void;
    prefixLines(prefix: string): void;
    focus(): void;
    goTo(position: { line: number; column: number }): void;
}

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) void unmount(instance);
    document.body.innerHTML = '';
});

async function settle() {
    flushSync();
    await tick();
    flushSync();
}

function render(value: string, preferences = new EditorPreferences()) {
    const instance = mount(EditorCodeArea as never, {
        target: document.body,
        props: {
            value,
            preferences,
            theme: 'light',
            placeholder: 'Write here',
            minHeight: '200px',
            problemLines: new Map([[2, 'error']])
        }
    }) as unknown as CodeArea;
    mounted.push(instance);
    flushSync();
    const textarea = document.querySelector<HTMLTextAreaElement>('#markdown-content');
    if (!textarea) throw new Error('editor did not render');
    return { area: instance, textarea };
}

function select(textarea: HTMLTextAreaElement, start: number, end = start) {
    textarea.setSelectionRange(start, end);
}

function press(textarea: HTMLTextAreaElement, key: string) {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    textarea.dispatchEvent(event);
    flushSync();
    return event.defaultPrevented;
}

test('the no-wrap layout numbers lines and marks the problem line', () => {
    const preferences = new EditorPreferences();
    preferences.lineWrapMode = 'none';
    render('first\nsecond\nthird', preferences);

    const numbers = [...document.querySelectorAll('.editor-gutter-num')];
    expect(numbers.map(node => node.textContent?.trim())).toEqual(['1', '2', '3']);
    expect(numbers[1]?.className).toContain('text-fg-danger');
    expect(numbers[0]?.className).toContain('editor-line-number-active');
    expect(document.querySelectorAll('.editor-code-line')).toHaveLength(3);
});

test('every exported edit changes the text and keeps the selection', async () => {
    const preferences = new EditorPreferences();
    preferences.lineWrapMode = 'none';
    const { area, textarea } = render('hello world', preferences);

    select(textarea, 0, 5);
    area.insert('**', '**');
    await settle();
    expect(textarea.value).toBe('**hello** world');
    expect(document.activeElement).toBe(textarea);

    select(textarea, textarea.value.length);
    area.insertBlock('```\n', '\n```');
    await settle();
    expect(textarea.value).toContain('```\n\n```');

    select(textarea, 0, 9);
    area.prefixLines('# ');
    await settle();
    expect(textarea.value.startsWith('# **hello**')).toBe(true);

    area.insertDefine();
    await settle();
    expect(textarea.value.startsWith(':::define\n')).toBe(true);

    textarea.value = ':::tip\nKeep it short.\n:::';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    select(textarea, 0, textarea.value.length);
    area.insertVerbatim();
    await settle();
    expect(textarea.value.startsWith('::::verbatim\n:::tip')).toBe(true);
    expect(textarea.value.endsWith(':::\n::::')).toBe(true);
});

test('focus and goTo move the caret to a line and column', async () => {
    const { area, textarea } = render('alpha\nbeta\ngamma');
    textarea.blur();
    area.focus();
    expect(document.activeElement).toBe(textarea);

    area.goTo({ line: 3, column: 3 });
    await settle();
    expect(textarea.selectionStart).toBe('alpha\nbeta\nga'.length);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);
});

test('Tab indents, Enter continues lists and leaves plain lines to the browser', async () => {
    const preferences = new EditorPreferences();
    preferences.indentMode = 'tabs';
    const { textarea } = render('- first', preferences);

    select(textarea, 0);
    expect(press(textarea, 'Tab')).toBe(true);
    await settle();
    expect(textarea.value).toBe('\t- first');

    select(textarea, textarea.value.length);
    expect(press(textarea, 'Enter')).toBe(true);
    await settle();
    expect(textarea.value).toBe('\t- first\n\t- ');

    textarea.value = 'plain text';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    select(textarea, textarea.value.length);
    expect(press(textarea, 'Enter')).toBe(false);
    expect(textarea.value).toBe('plain text');
});
