// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { A11Y_STORAGE_KEY, A11Y_SYSTEM_QUERIES } from '../packages/ui/src/a11ySettings.ts';

mock.module('$app/env', () => ({ browser: true, dev: false, building: false, version: 'test' }));

const { A11Y_TOGGLES, a11yStore } = await import('../packages/ui/src/stores/a11yStore.svelte.ts');
const { themeStore } = await import('../packages/ui/src/stores/themeStore.svelte.ts');

interface FakeList {
    media: string;
    matches: boolean;
    listeners: Set<() => void>;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
}

const lists = new Map<string, FakeList>();
let unsupported = new Set<string>();

function installMatchMedia() {
    lists.clear();
    window.matchMedia = ((query: string) => {
        const existing = lists.get(query);
        if (existing) return existing;
        const list: FakeList = {
            media: unsupported.has(query) ? 'not all' : query,
            matches: false,
            listeners: new Set(),
            addEventListener: (_, listener) => list.listeners.add(listener),
            removeEventListener: (_, listener) => list.listeners.delete(listener)
        };
        lists.set(query, list);
        return list;
    }) as never;
}

beforeEach(() => {
    unsupported = new Set();
    installMatchMedia();
    localStorage.clear();
    document.documentElement.className = '';
});

afterEach(() => {
    a11yStore.reset();
});

describe('a11yStore', () => {
    test('reads system preferences and lets overrides win', () => {
        const [reduceMotionQuery] = Object.values(A11Y_SYSTEM_QUERIES);
        installMatchMedia();
        const probe = window.matchMedia(reduceMotionQuery) as unknown as FakeList;
        probe.matches = true;
        const stop = a11yStore.init();
        expect(a11yStore.current.reduceMotion).toBe(true);
        expect(a11yStore.enabledByDevice('reduceMotion')).toBe(true);
        expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('true');
        a11yStore.toggleReduceMotion();
        expect(a11yStore.current.reduceMotion).toBe(false);
        expect(a11yStore.enabledByDevice('reduceMotion')).toBe(false);
        expect(localStorage.getItem(A11Y_STORAGE_KEY)).toContain('reduceMotion');
        probe.matches = false;
        probe.listeners.forEach(listener => listener());
        stop?.();
        expect(probe.listeners.size).toBe(0);
    });

    test('toggles every setting, scales fonts and resets storage', () => {
        a11yStore.init();
        for (const toggle of A11Y_TOGGLES) toggle.toggle();
        a11yStore.setFontScale(2 as never);
        expect(document.documentElement.getAttribute('data-font-scale')).toBe('2');
        expect(a11yStore.current.highContrast).toBe(true);
        expect(a11yStore.current.focusHighlight).toBe(true);
        expect(a11yStore.current.dyslexicFont).toBe(true);
        a11yStore.reset();
        expect(localStorage.getItem(A11Y_STORAGE_KEY)).toBeNull();
    });

    test('follows storage events from other tabs and survives broken storage', () => {
        const stop = a11yStore.init();
        window.dispatchEvent(
            new window.StorageEvent('storage', {
                key: A11Y_STORAGE_KEY,
                newValue: '{"highContrast":true}'
            })
        );
        expect(a11yStore.current.highContrast).toBe(true);
        window.dispatchEvent(new window.StorageEvent('storage', { key: 'other', newValue: 'x' }));
        stop?.();

        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = () => {
            throw new Error('blocked');
        };
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
            throw new Error('blocked');
        };
        try {
            a11yStore.init()?.();
            a11yStore.toggleHighContrast();
        } finally {
            Storage.prototype.getItem = original;
            Storage.prototype.setItem = setItem;
        }
    });

    test('ignores unsupported media queries', () => {
        unsupported = new Set(Object.values(A11Y_SYSTEM_QUERIES));
        installMatchMedia();
        a11yStore.init()?.();
        expect(a11yStore.current.reduceMotion).toBe(false);
    });
});

describe('themeStore', () => {
    test('applies, persists and cycles through the themes', () => {
        expect(themeStore.cycle()).toBe('light');
        expect(themeStore.isDark).toBe(false);
        expect(themeStore.cycle()).toBe('dark');
        expect(themeStore.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
        expect(themeStore.cycle()).toBe('auto');
        expect(themeStore.current).toBe('auto');
    });

    test('initialises from storage, follows the system in auto mode and other tabs', () => {
        localStorage.setItem('theme', 'dark');
        const stop = themeStore.init();
        expect(themeStore.current).toBe('dark');
        localStorage.setItem('theme', 'bogus');
        stop?.();
        const stopAuto = themeStore.init();
        expect(themeStore.current).toBe('auto');
        const query = window.matchMedia('(prefers-color-scheme: dark)') as unknown as FakeList;
        query.matches = true;
        query.listeners.forEach(listener => listener());
        expect(themeStore.isDark).toBe(true);
        window.dispatchEvent(
            new window.StorageEvent('storage', { key: 'theme', newValue: 'light' })
        );
        expect(themeStore.current).toBe('light');
        query.listeners.forEach(listener => listener());
        expect(themeStore.isDark).toBe(false);
        window.dispatchEvent(
            new window.StorageEvent('storage', { key: 'other', newValue: 'dark' })
        );
        stopAuto?.();
        themeStore.apply('auto');
    });

    test('keeps working when storage throws', () => {
        const getItem = Storage.prototype.getItem;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.getItem = () => {
            throw new Error('blocked');
        };
        Storage.prototype.setItem = () => {
            throw new Error('blocked');
        };
        try {
            themeStore.init()?.();
            themeStore.apply('dark');
            expect(themeStore.isDark).toBe(true);
        } finally {
            Storage.prototype.getItem = getItem;
            Storage.prototype.setItem = setItem;
            themeStore.apply('auto');
        }
    });
});
