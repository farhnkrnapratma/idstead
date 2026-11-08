// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { afterEach, expect, mock, test } from 'bun:test';

mock.module('$app/env', () => ({ browser: true }));

const { codeBlockPrefsStore } =
    await import('../packages/mdrs/dom/src/codeBlockPrefsStore.svelte.ts');

const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function storage(overrides: Partial<Storage> = {}) {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: () => null, setItem: () => {}, ...overrides }
    });
}

afterEach(() => {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    codeBlockPrefsStore.init();
});

test('keeps working when storage refuses writes or reads', () => {
    storage({
        setItem: () => {
            throw new Error('full');
        },
        getItem: () => {
            throw new Error('blocked');
        }
    });
    codeBlockPrefsStore.setWrap(true);
    expect(codeBlockPrefsStore.current.wrap).toBe(true);
    codeBlockPrefsStore.init();
    expect(codeBlockPrefsStore.current.wrap).toBe(false);
});

test('restores stored preferences and ignores invalid or non-object values', () => {
    storage({ getItem: () => '{"wrap":true,"minimal":true}' });
    codeBlockPrefsStore.init();
    expect(codeBlockPrefsStore.current).toMatchObject({ wrap: true, minimal: true });

    storage({ getItem: () => '{not json' });
    codeBlockPrefsStore.init();
    expect(codeBlockPrefsStore.current.wrap).toBe(false);

    storage({ getItem: () => '"text"' });
    codeBlockPrefsStore.init();
    expect(codeBlockPrefsStore.current.wrap).toBe(false);
});

test('notifies the page when another tab changes the preferences', () => {
    let changes = 0;
    const stop = codeBlockPrefsStore.subscribe(() => changes++);
    codeBlockPrefsStore.init(() => changes++);
    window.dispatchEvent(
        new StorageEvent('storage', { key: 'codeblock_prefs', newValue: '{"lineNumbers":false}' })
    );
    expect(codeBlockPrefsStore.current.lineNumbers).toBe(false);
    expect(changes).toBeGreaterThan(0);
    stop();
});
