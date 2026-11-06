// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, test } from 'bun:test';
import { platformStore } from '../packages/ui/src/stores/platformStore.svelte.ts';
import { shortcutStore } from '../packages/ui/src/stores/shortcutStore.svelte.ts';

const wait = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));

function press(code: string, init: Record<string, unknown> = {}, target: EventTarget = window) {
    const event = new window.KeyboardEvent('keydown', {
        code,
        key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
        bubbles: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
}

const leader = () => press('Space', { ctrlKey: true });

function button(label = 'b', visible = true) {
    const element = document.createElement('button');
    element.textContent = label;
    (element as unknown as { checkVisibility: () => boolean }).checkVisibility = () => visible;
    document.body.append(element);
    let clicks = 0;
    element.addEventListener('click', () => clicks++);
    return { element, clicks: () => clicks };
}

const registered: string[] = [];
const cleanups: (() => void)[] = [];

function add(entry: Parameters<typeof shortcutStore.register>[0]) {
    const id = shortcutStore.register(entry);
    registered.push(id);
    return id;
}

afterEach(() => {
    registered.splice(0).forEach(id => shortcutStore.unregister(id));
    cleanups.splice(0).forEach(cleanup => cleanup());
    shortcutStore.disarm();
    shortcutStore.catalogOpen = false;
    document.body.innerHTML = '';
});

describe('shortcutStore leader', () => {
    test('arms and disarms with Ctrl+Space, Escape, blur and the timeout', () => {
        add({ combos: ['Shift+X'], label: 'x', scope: 'page', element: button().element });
        expect(shortcutStore.leaderArmed).toBe(false);
        expect(leader().defaultPrevented).toBe(true);
        expect(shortcutStore.leaderArmed).toBe(true);
        expect(shortcutStore.armedAt).toBeGreaterThan(0);
        leader();
        expect(shortcutStore.leaderArmed).toBe(false);
        leader();
        press('Escape', { key: 'Escape' });
        expect(shortcutStore.leaderArmed).toBe(false);
        leader();
        window.dispatchEvent(new window.Event('blur'));
        expect(shortcutStore.leaderArmed).toBe(false);
        press('KeyQ');
        expect(shortcutStore.leaderArmed).toBe(false);
    });

    test('tracks the Alt key', () => {
        press('AltLeft', { key: 'Alt' });
        expect(shortcutStore.altHeld).toBe(true);
        press('AltLeft', { key: 'Alt' });
        window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Shift' }));
        expect(shortcutStore.altHeld).toBe(true);
        window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Alt' }));
        expect(shortcutStore.altHeld).toBe(false);
    });

    test('opens and closes the catalog after the leader', () => {
        leader();
        press('Space');
        expect(shortcutStore.catalogOpen).toBe(true);
        leader();
        press('Space');
        expect(shortcutStore.catalogOpen).toBe(false);
    });
});

describe('shortcutStore entries', () => {
    test('clicks the matching control and focuses text fields instead', () => {
        const target = button();
        add({ combos: ['Shift+X'], label: 'x', scope: 'page', element: target.element });
        const field = document.createElement('input');
        document.body.append(field);
        add({ combos: ['Shift+Y'], label: 'y', scope: 'page', element: field });
        leader();
        press('KeyX', { shiftKey: true });
        expect(target.clicks()).toBe(1);
        expect(shortcutStore.leaderArmed).toBe(false);
        leader();
        press('KeyY', { shiftKey: true });
        expect(document.activeElement).toBe(field);
        leader();
        press('KeyZ', { shiftKey: true });
        expect(target.clicks()).toBe(1);
    });

    test('prefers a visible duplicate and survives update and unregister', () => {
        const hidden = button('h', false);
        const shown = button('s', true);
        const first = add({
            combos: ['Shift+X'],
            label: 'x',
            scope: 'page',
            element: hidden.element
        });
        add({ combos: ['Shift+X'], label: 'x', scope: 'page', element: shown.element });
        shortcutStore.update(first, { label: 'x' });
        shortcutStore.update(first, { combos: ['Shift+X'], group: undefined, chordKey: undefined });
        shortcutStore.update('missing', { label: 'x' });
        leader();
        press('KeyX', { shiftKey: true });
        expect(shown.clicks()).toBe(1);
        shortcutStore.update(first, { label: 'renamed', combos: ['Shift+W'], scope: 'page' });
        leader();
        press('KeyW', { shiftKey: true });
        expect(hidden.clicks()).toBe(1);
    });

    test('drops disconnected entries when registering new ones', () => {
        const gone = button();
        add({ combos: ['Shift+X'], label: 'x', scope: 'page', element: gone.element });
        gone.element.remove();
        add({ combos: ['Shift+Q'], label: 'q', scope: 'page', element: button().element });
        leader();
        press('KeyX', { shiftKey: true });
        expect(gone.clicks()).toBe(0);
    });

    test('runs form-scoped shortcuts from inside a text field', () => {
        document.body.innerHTML = '<form><input id="f"></form>';
        const form = document.querySelector('form') as HTMLFormElement;
        const submit = document.createElement('button');
        (submit as unknown as { checkVisibility: () => boolean }).checkVisibility = () => true;
        form.append(submit);
        let clicked = 0;
        submit.addEventListener('click', () => clicked++);
        add({ combos: ['Shift+X'], label: 'save', scope: 'page', element: submit });
        const field = document.getElementById('f') as HTMLInputElement;
        leader();
        press('KeyX', { shiftKey: true }, field);
        expect(clicked).toBe(1);
        leader();
        press('KeyQ', {}, field);
        expect(shortcutStore.leaderArmed).toBe(false);
        leader();
        press('ShiftLeft', {}, field);
        expect(shortcutStore.leaderArmed).toBe(true);
        press('Escape', { key: 'Escape' });
        const outside = document.createElement('input');
        document.body.append(outside);
        leader();
        press('KeyX', { shiftKey: true }, outside);
        expect(clicked).toBe(1);
    });
});

describe('shortcutStore chord groups', () => {
    test('labels group members by DOM order and resolves a chord', () => {
        const members = [button('one'), button('two'), button('three')];
        const ids = members.map(member =>
            add({
                combos: [],
                group: 'posts',
                label: member.element.textContent!,
                scope: 'page',
                element: member.element
            })
        );
        leader();
        press('KeyB', { shiftKey: true });
        expect(shortcutStore.pendingGroup).toBe('posts');
        expect(shortcutStore.hintFor(ids[0])).toEqual(['0']);
        expect(shortcutStore.hintFor(ids[1])).toEqual(['1']);
        expect(shortcutStore.hintFor('unknown')).toEqual([]);
        press('Digit1');
        expect(members[1].clicks()).toBe(1);
        expect(shortcutStore.pendingGroup).toBeNull();
        leader();
        press('KeyB', { shiftKey: true });
        press('Slash');
        expect(shortcutStore.pendingGroup).toBe('posts');
        press('Escape', { key: 'Escape' });
        expect(shortcutStore.leaderArmed).toBe(false);
    });

    test('honours explicit chord keys, dedupes labels and lists the catalog', () => {
        const a = button('same');
        const b = button('same');
        const c = button('other');
        const pinned = button('pinned');
        add({ combos: [], group: 'posts', label: 'same', scope: 'page', element: a.element });
        add({ combos: [], group: 'posts', label: 'same', scope: 'page', element: b.element });
        add({ combos: [], group: 'posts', label: 'other', scope: 'page', element: c.element });
        add({
            combos: [],
            group: 'posts',
            chordKey: 'z',
            label: 'pinned',
            scope: 'page',
            element: pinned.element
        });
        const entries = shortcutStore.catalogEntries();
        expect(entries.map(entry => entry.chordKey).sort()).toEqual(['0', '1', 'z']);
        leader();
        press('KeyB', { shiftKey: true });
        press('KeyZ');
        expect(pinned.clicks()).toBe(1);
    });

    test('shows hints while the leader or Alt is held', () => {
        const target = button('t');
        const entry = add({
            combos: ['Shift+X'],
            label: 't',
            scope: 'page',
            element: target.element
        });
        const grouped = add({
            combos: [],
            group: 'posts',
            label: 'g',
            scope: 'page',
            element: button('g').element
        });
        expect(shortcutStore.hintFor(entry)).toEqual([]);
        platformStore.detect();
        leader();
        expect(shortcutStore.hintFor(entry).length).toBeGreaterThan(0);
        expect(shortcutStore.hintFor(grouped).length).toBeGreaterThan(0);
        shortcutStore.armGroup('posts');
        expect(shortcutStore.hintFor(entry)).toEqual([]);
        expect(shortcutStore.hintFor(grouped)).toEqual(['0']);
        shortcutStore.armGroup('unknown');
        shortcutStore.disarm();
        press('AltLeft', { key: 'Alt' });
        expect(shortcutStore.hintFor(entry).length).toBeGreaterThan(0);
        window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Alt' }));
    });
});

describe('shortcutStore commands and scopes', () => {
    test('runs registered commands, including chorded command keys', () => {
        const ran: string[] = [];
        cleanups.push(shortcutStore.registerCommand('Shift+Z', 'zed', () => ran.push('z')));
        const replace = shortcutStore.registerCommand('Shift+Z', 'zed2', () => ran.push('z2'));
        cleanups.push(shortcutStore.registerCommand('G h', 'home', () => ran.push('home')));
        leader();
        press('KeyZ', { shiftKey: true });
        expect(ran).toEqual(['z2']);
        replace();
        shortcutStore.runCommand('shift+z');
        shortcutStore.runCommand('missing');
        expect(ran).toEqual(['z2']);
        cleanups.push(shortcutStore.registerCommand('g a', 'go a', () => ran.push('ga')));
        leader();
        shortcutStore.armGroup('go');
        expect(shortcutStore.pendingGroup).toBe('go');
        press('KeyA');
        expect(ran.at(-1)).toBe('ga');
    });

    test('keeps modal scopes exclusive and restores the previous scope', () => {
        const page = button('page');
        const modal = button('modal');
        add({ combos: ['Shift+X'], label: 'page', scope: 'page', element: page.element });
        add({ combos: ['Shift+X'], label: 'modal', scope: 'dialog', element: modal.element });
        const ran: string[] = [];
        cleanups.push(shortcutStore.registerCommand('Shift+C', 'c', () => ran.push('c')));
        shortcutStore.pushScope('dialog', true);
        expect(shortcutStore.activeScope).toBe('dialog');
        leader();
        press('KeyX', { shiftKey: true });
        expect(modal.clicks()).toBe(1);
        expect(page.clicks()).toBe(0);
        leader();
        press('KeyC', { shiftKey: true });
        expect(ran).toEqual([]);
        shortcutStore.popScope('dialog');
        shortcutStore.popScope('dialog');
        shortcutStore.popScope('page');
        expect(shortcutStore.activeScope).toBe('page');
        shortcutStore.pushScope('inline');
        add({ combos: ['Shift+V'], label: 'v', scope: 'inline', element: button('v').element });
        expect(shortcutStore.activeScope).toBe('inline');
        shortcutStore.popScope('inline');
    });
});

describe('shortcutStore disable', () => {
    test('stops listening and ignores further registration', () => {
        const target = button();
        add({ combos: ['Shift+X'], label: 'x', scope: 'page', element: target.element });
        shortcutStore.disable();
        expect(shortcutStore.enabled).toBe(false);
        expect(
            shortcutStore.register({
                combos: [],
                label: 'x',
                scope: 'page',
                element: target.element
            })
        ).toBe('');
        expect(shortcutStore.registerCommand('Shift+Q', 'q', () => {})()).toBeUndefined();
        shortcutStore.pushScope('x', true);
        shortcutStore.popScope('x');
        shortcutStore.armGroup('posts');
        leader();
        expect(shortcutStore.leaderArmed).toBe(false);
        expect(shortcutStore.catalogEntries()).toEqual([]);
        void wait;
    });
});
