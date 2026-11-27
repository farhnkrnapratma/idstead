// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, jest, test } from 'bun:test';
import { flushSync } from 'svelte';
import { click, confirmDialog, openAdmin, settle, text, toast } from './support/adminHarness.ts';

type Listener = (event: { matches: boolean }) => void;

const realMatchMedia = window.matchMedia;
const realClientRects = HTMLElement.prototype.getClientRects;
const desktop = { matches: true, listeners: new Set<Listener>() };

window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
        return desktop.matches;
    },
    addEventListener: (_type: string, listener: Listener) => desktop.listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => desktop.listeners.delete(listener),
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false
})) as unknown as typeof window.matchMedia;

afterEach(() => {
    desktop.matches = true;
    desktop.listeners.clear();
    localStorage.clear();
    sessionStorage.clear();
});

function sidebar() {
    const element = document.querySelector<HTMLElement>('[aria-label="Admin sidebar"]');
    if (!element) throw new Error('No sidebar');
    return element;
}

function slider() {
    const element = document.querySelector<HTMLElement>(
        '[role="slider"][aria-label="Sidebar width"]'
    );
    if (!element) throw new Error('No sidebar slider');
    return element;
}

function key(target: EventTarget, name: string, shiftKey = false) {
    const event = new KeyboardEvent('keydown', {
        key: name,
        shiftKey,
        bubbles: true,
        cancelable: true
    });
    target.dispatchEvent(event);
    flushSync();
    return event;
}

test('the mobile sidebar traps focus, closes on Escape and when the window widens', async () => {
    desktop.matches = false;
    await openAdmin('');
    expect(sidebar().inert).toBe(true);

    await click('Open sidebar');
    expect(sidebar().inert).toBe(false);
    expect(document.getElementById('main')?.inert).toBe(true);

    HTMLElement.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
    const focusable = [
        ...sidebar().querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')
    ];
    focusable.at(-1)?.focus();
    expect(key(sidebar(), 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable[0] ?? null);
    expect(key(sidebar(), 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable.at(-1) ?? null);
    expect(key(sidebar(), 'Tab').defaultPrevented).toBe(true);
    expect(key(sidebar(), 'Enter').defaultPrevented).toBe(false);

    key(sidebar(), 'Escape');
    await settle();
    expect(document.getElementById('main')?.inert).toBe(false);

    await click('Open sidebar');
    desktop.matches = true;
    expect(document.getElementById('main')?.inert).toBe(true);
    for (const listener of [...desktop.listeners]) listener({ matches: true });
    await settle();
    expect(document.getElementById('main')?.inert).toBe(false);
});

test('dragging and arrow keys resize the sidebar and remember its size', async () => {
    await openAdmin('');
    const width = window.innerWidth;

    slider().dispatchEvent(
        new PointerEvent('pointerdown', { clientX: width * 0.15, bubbles: true })
    );
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: width * 0.18 }));
    await new Promise(resolve => setTimeout(resolve, 40));
    window.dispatchEvent(new PointerEvent('pointerup'));
    flushSync();
    expect(Number(localStorage.getItem('admin-sidebar-width'))).toBeGreaterThan(width * 0.15);

    slider().dispatchEvent(
        new PointerEvent('pointerdown', { clientX: width * 0.15, bubbles: true })
    );
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1 }));
    await new Promise(resolve => setTimeout(resolve, 40));
    window.dispatchEvent(new PointerEvent('pointercancel'));
    flushSync();
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('1');

    expect(key(slider(), 'ArrowLeft').defaultPrevented).toBe(true);
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('1');
    key(slider(), 'ArrowRight');
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('0');
    key(slider(), 'ArrowRight');
    key(slider(), 'ArrowLeft');
    key(slider(), 'ArrowLeft');
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('1');
    expect(key(slider(), 'Home').defaultPrevented).toBe(false);

    await click('Expand sidebar');
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('0');
    await click('Collapse sidebar');
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('1');
});

test('a saved sidebar width and a pending toast are restored on load', async () => {
    localStorage.setItem('admin-sidebar-width', '99999');
    sessionStorage.setItem(
        'admin_toast',
        JSON.stringify({ message: 'Welcome back.', type: 'info' })
    );
    await openAdmin('');
    expect(toast()).toEqual({ message: 'Welcome back.', type: 'info' });

    sessionStorage.setItem('admin_toast', '{broken');
    await openAdmin('');
    expect(sessionStorage.getItem('admin_toast')).toBeNull();
});

test('an idle session warns, can be extended, and signs out once the deadline passes', async () => {
    await openAdmin('');
    jest.useFakeTimers();
    try {
        window.dispatchEvent(new Event('mousemove'));
        jest.advanceTimersByTime(30 * 60 * 1000);
        flushSync();
        expect(text()).toContain('Stay signed in');

        window.dispatchEvent(new Event('keydown'));
        button('Stay signed in').click();
        flushSync();
        expect(text()).not.toContain('Stay signed in');

        jest.advanceTimersByTime(60 * 60 * 1000);
        flushSync();
        expect(text()).toContain('Stay signed in');
        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            configurable: true
        });
        jest.advanceTimersByTime(5 * 60 * 1000);
        document.dispatchEvent(new Event('visibilitychange'));
        flushSync();
    } finally {
        jest.useRealTimers();
    }
});

test('signing out asks first, then leaves for the Access logout', async () => {
    await openAdmin('');
    await click('Sign out');
    expect(text()).toContain('Are you sure you want to sign out of the admin console?');
    await confirmDialog('Sign out');
    expect(window.location.pathname).toBe('/cdn-cgi/access/logout');
});

function button(name: string) {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        element => element.textContent?.trim() === name
    );
    if (!found) throw new Error(`No button ${name}`);
    return found;
}

afterEach(() => {
    window.matchMedia = realMatchMedia;
    HTMLElement.prototype.getClientRects = realClientRects;
});
