// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import PillInput from '../packages/ui/src/components/PillInput.svelte';

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) void unmount(instance);
    document.body.innerHTML = '';
});

async function settle() {
    for (let round = 0; round < 3; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
}

function render(initial: string[], extra: Record<string, unknown> = {}) {
    const value = [...initial];
    mounted.push(
        mount(PillInput as never, {
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
                variant: 'standard',
                ...extra
            }
        })
    );
    flushSync();
    return value;
}

function pills() {
    return [...document.querySelectorAll<HTMLElement>('[role="group"]')];
}

function withData<T extends Event>(event: T, key: string, data: object) {
    Object.defineProperty(event, key, { value: data });
    return event;
}

function typeKey(input: HTMLInputElement, text: string, key: string) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(text.length, text.length);
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    flushSync();
    return event;
}

test('dragging a pill onto another moves it there', async () => {
    const value = render(['alpha', 'beta', 'gamma']);
    const ghosts: Element[] = [];
    const transfer = {
        effectAllowed: '',
        data: '',
        setData(_type: string, data: string) {
            this.data = data;
        },
        setDragImage(node: Element) {
            ghosts.push(node);
        }
    };

    pills()[0]?.dispatchEvent(
        withData(new Event('dragstart', { bubbles: true }), 'dataTransfer', transfer)
    );
    expect(transfer.effectAllowed).toBe('move');
    expect(transfer.data).toBe('0');
    expect(ghosts[0]?.isConnected).toBe(true);

    const drop = withData(
        new Event('drop', { bubbles: true, cancelable: true }),
        'dataTransfer',
        transfer
    );
    pills()[2]?.dispatchEvent(drop);
    await settle();
    expect(drop.defaultPrevented).toBe(true);
    expect(value).toEqual(['beta', 'gamma', 'alpha']);
    expect(ghosts[0]?.isConnected).toBe(false);

    pills()[1]?.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await settle();
    expect(value).toEqual(['beta', 'gamma', 'alpha']);
});

test('pasting a list adds each new item up to the limit', async () => {
    const value = render(['alpha'], {
        maxItems: 3,
        transformItem: (item: string) => item.toLowerCase()
    });
    const input = document.querySelector<HTMLInputElement>('input#tags');
    if (!input) throw new Error('input missing');

    const paste = withData(
        new Event('paste', { bubbles: true, cancelable: true }),
        'clipboardData',
        { getData: () => 'Alpha, Beta\\, Gamma, Delta, Echo' }
    );
    input.dispatchEvent(paste);
    await settle();
    expect(paste.defaultPrevented).toBe(true);
    expect(value).toEqual(['alpha', 'beta, gamma', 'delta']);

    const empty = withData(
        new Event('paste', { bubbles: true, cancelable: true }),
        'clipboardData',
        { getData: () => '' }
    );
    input.dispatchEvent(empty);
    expect(empty.defaultPrevented).toBe(false);
});

test('a custom paste handler replaces the built-in one', () => {
    const seen: Event[] = [];
    const value = render([], { onPaste: (event: Event) => seen.push(event) });
    const input = document.querySelector<HTMLInputElement>('input#tags');
    input?.dispatchEvent(
        withData(new Event('paste', { bubbles: true, cancelable: true }), 'clipboardData', {
            getData: () => 'one, two'
        })
    );
    expect(seen).toHaveLength(1);
    expect(value).toEqual([]);
});

test('a backslash before a comma keeps the comma inside the item', async () => {
    const value = render([]);
    const input = document.querySelector<HTMLInputElement>('input#tags');
    if (!input) throw new Error('input missing');

    const escaped = typeKey(input, 'Hello\\', ',');
    await settle();
    expect(escaped.defaultPrevented).toBe(true);
    expect(input.value).toBe('Hello,');
    expect(value).toEqual([]);

    typeKey(input, 'Hello, world', ',');
    await settle();
    expect(value).toEqual(['Hello, world']);
});

test('editing a pill escapes commas the same way and saves on a plain comma', async () => {
    const value = render(['alpha']);
    document.querySelector<HTMLElement>('[data-pill-text]')?.click();
    flushSync();
    const editor = document.querySelector<HTMLInputElement>('#tags-edit-0');
    if (!editor) throw new Error('edit input missing');

    typeKey(editor, 'one\\', ',');
    await settle();
    expect(editor.value).toBe('one,');
    expect(value).toEqual(['alpha']);

    typeKey(editor, 'one, two', ',');
    await settle();
    expect(value).toEqual(['one, two']);
    expect(document.querySelector('#tags-edit-0')).toBeNull();
});
