// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, test } from 'bun:test';
import { detectPlatform } from '../packages/ui/src/platform.ts';
import { splitEscapedCommas, tryEscapeComma } from '../packages/ui/src/utils/pillParsing.ts';
import { popoverPosition } from '../packages/ui/src/utils/popoverPosition.ts';
import {
    findSubmitter,
    installSubmitShortcut,
    isSubmitChord,
    resolveSubmit,
    type SubmitKeyEvent
} from '../packages/ui/src/utils/submitShortcut.ts';
import { withViewTransition } from '../packages/ui/src/utils/viewTransition.ts';

describe('pill parsing', () => {
    test('turns an escaped comma into a literal one', () => {
        expect(tryEscapeComma('a\\b', 2)).toEqual({ value: 'a,b', cursor: 2 });
        expect(tryEscapeComma('ab', 2)).toBeNull();
        expect(tryEscapeComma('\\', 0)).toBeNull();
    });

    test('splits on bare commas only and trims empties', () => {
        expect(splitEscapedCommas('a, b\\,c ,, d')).toEqual(['a', 'b,c', 'd']);
        expect(splitEscapedCommas('')).toEqual([]);
    });
});

describe('detectPlatform', () => {
    test('reads the client hints, platform and user agent', () => {
        expect(detectPlatform(null)).toBe('other');
        expect(detectPlatform({ userAgentData: { platform: 'macOS' } })).toBe('mac');
        expect(detectPlatform({ platform: 'iPhone' })).toBe('mac');
        expect(detectPlatform({ userAgent: 'Mozilla Windows NT' })).toBe('windows');
        expect(detectPlatform({ userAgent: 'X11; Linux x86_64' })).toBe('linux');
        expect(detectPlatform({ userAgent: 'Plan9' })).toBe('other');
        expect(detectPlatform({ userAgentData: null })).toBe('other');
    });
});

const chord = (
    overrides: Partial<SubmitKeyEvent> = {},
    target: unknown = null
): SubmitKeyEvent => ({
    key: 'Enter',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    target,
    ...overrides
});

describe('submit shortcut', () => {
    const submit = { tagName: 'BUTTON', type: 'submit', disabled: false };
    const form = {
        elements: [{ tagName: 'INPUT', type: 'text' }, { ...submit, disabled: true }, submit]
    };

    test('recognises only a plain Ctrl or Cmd Enter', () => {
        expect(isSubmitChord(chord())).toBe(true);
        expect(isSubmitChord(chord({ ctrlKey: false, metaKey: true }))).toBe(true);
        for (const bad of [
            { key: 'a' },
            { ctrlKey: false },
            { altKey: true },
            { shiftKey: true },
            { repeat: true },
            { isComposing: true },
            { keyCode: 229 }
        ]) {
            expect(isSubmitChord(chord(bad))).toBe(false);
        }
    });

    test('finds the first enabled submit control', () => {
        expect(findSubmitter(form)).toBe(form.elements[2] as never);
        expect(findSubmitter({ elements: [{ tagName: 'DIV' }] })).toBeUndefined();
    });

    test('resolves a form from the target or its ancestor', () => {
        const direct = { form, closest: () => null };
        expect(resolveSubmit(chord({}, direct))?.form).toBe(form);
        const nested = { closest: (selector: string) => (selector === 'form' ? form : null) };
        expect(resolveSubmit(chord({}, nested))?.form).toBe(form);
        expect(resolveSubmit(chord({ defaultPrevented: true }, direct))).toBeNull();
        expect(resolveSubmit(chord({}, null))).toBeNull();
        expect(resolveSubmit(chord({}, {}))).toBeNull();
        expect(
            resolveSubmit(chord({}, { closest: (s: string) => (s.includes('button') ? {} : null) }))
        ).toBeNull();
        expect(resolveSubmit(chord({}, { closest: () => null }))).toBeNull();
        expect(
            resolveSubmit(chord({}, { form: { elements: [] }, closest: () => null }))
        ).toBeNull();
    });

    test('submits the focused form once and releases the guard', async () => {
        document.body.innerHTML =
            '<form><textarea id="t"></textarea><button type="submit">Go</button></form>';
        const area = document.getElementById('t') as HTMLTextAreaElement;
        const formElement = document.querySelector('form') as HTMLFormElement;
        const submitted: unknown[] = [];
        formElement.requestSubmit = ((submitter?: unknown) => submitted.push(submitter)) as never;
        area.focus();
        const uninstall = installSubmitShortcut(window);
        const press = () =>
            area.dispatchEvent(
                new window.KeyboardEvent('keydown', {
                    key: 'Enter',
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true
                })
            );
        press();
        press();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(submitted).toHaveLength(1);
        press();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(submitted).toHaveLength(2);
        uninstall();
        press();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(submitted).toHaveLength(2);
    });
});

describe('popoverPosition', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    function layout(anchorRect: Partial<DOMRect>, popoverSize: { w: number; h: number }) {
        document.body.innerHTML = '<div id="anchor"><div id="pop"></div></div>';
        const anchor = document.getElementById('anchor') as HTMLElement;
        const node = document.getElementById('pop') as HTMLElement;
        const full = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, ...anchorRect };
        full.bottom = full.top + full.height;
        full.right = full.left + full.width;
        anchor.getBoundingClientRect = () => full as DOMRect;
        Object.defineProperty(node, 'offsetWidth', { value: popoverSize.w, configurable: true });
        Object.defineProperty(node, 'offsetHeight', { value: popoverSize.h, configurable: true });
        Object.defineProperty(document.documentElement, 'clientWidth', {
            value: 1000,
            configurable: true
        });
        Object.defineProperty(document.documentElement, 'clientHeight', {
            value: 800,
            configurable: true
        });
        return { anchor, node };
    }

    const settle = () => new Promise(resolve => setTimeout(resolve, 30));

    test('places below by default and aligns to the end', async () => {
        const { node } = layout(
            { top: 100, left: 300, width: 100, height: 20 },
            { w: 150, h: 100 }
        );
        const action = popoverPosition(node, { matchWidth: true });
        await settle();
        expect(node.getAttribute('data-placement')).toBe('bottom');
        expect(node.style.width).toBe('100px');
        expect(node.style.top).toBe('26px');
        action.destroy();
    });

    test('flips above when there is no room below and centres without a suffix', async () => {
        const { node } = layout(
            { top: 700, left: 450, width: 100, height: 20 },
            { w: 200, h: 300 }
        );
        const action = popoverPosition(node, { placement: 'bottom' });
        await settle();
        expect(node.getAttribute('data-placement')).toBe('top');
        expect(node.style.left).toBe('-50px');
        action.destroy();
    });

    test('honours top placement, falls back below, and clamps to the viewport', async () => {
        const { node } = layout({ top: 20, left: 900, width: 100, height: 20 }, { w: 300, h: 500 });
        const action = popoverPosition(node, { placement: 'top-start', strategy: 'fixed' });
        await settle();
        expect(node.getAttribute('data-placement')).toBe('bottom');
        expect(Number.parseInt(node.style.left)).toBeLessThanOrEqual(700);
        action.update({ placement: 'top-end', anchor: node.parentElement, offset: 2, padding: 4 });
        await settle();
        action.update();
        await settle();
        action.destroy();
    });

    test('keeps the popover inside the left edge and prefers top when it fits', async () => {
        const { node } = layout({ top: 600, left: 0, width: 20, height: 20 }, { w: 400, h: 100 });
        const action = popoverPosition(node, { placement: 'top-end', autoMaxHeight: false });
        await settle();
        expect(node.getAttribute('data-placement')).toBe('top');
        expect(node.style.left).toBe('8px');
        expect(node.style.maxHeight).toBe('');
        action.destroy();
    });

    test('does nothing without an anchor', async () => {
        const node = document.createElement('div');
        const action = popoverPosition(node);
        await settle();
        expect(node.getAttribute('data-placement')).toBeNull();
        action.destroy();
    });
});

describe('withViewTransition', () => {
    test('runs the update directly when view transitions are unavailable', async () => {
        const calls: string[] = [];
        const document_ = document as unknown as { startViewTransition?: unknown };
        delete document_.startViewTransition;
        withViewTransition(() => void calls.push('plain'), 'context');
        expect(calls).toEqual(['plain']);

        let ran = 0;
        document_.startViewTransition = (callback: () => Promise<void>) => {
            const finished = callback().then(() => {});
            return { finished };
        };
        withViewTransition(() => void ran++, 'drill');
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(ran).toBe(1);
        expect(document.documentElement.dataset.transitionType).toBeUndefined();
        delete document_.startViewTransition;
    });
});
