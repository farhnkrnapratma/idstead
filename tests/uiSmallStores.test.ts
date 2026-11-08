// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('$app/env', () => ({ browser: true, dev: false, building: false, version: 'test' }));

const { toastStore } = await import('../packages/ui/src/stores/toastStore.svelte.ts');
const { scrollStore } = await import('../packages/ui/src/stores/scrollStore.svelte.ts');
const { platformStore } = await import('../packages/ui/src/stores/platformStore.svelte.ts');
const { readingModeStore } = await import('../packages/ui/src/stores/readingModeStore.svelte.ts');
const { shortcutStore } = await import('../packages/ui/src/stores/shortcutStore.svelte.ts');
const { autoResize, portal, staggerChildren } = await import('../packages/ui/src/utils/actions.ts');
const { copyText, downloadUrl } = await import('../packages/ui/src/utils/fileActions.ts');
const { focusScope } = await import('../packages/ui/src/utils/focusScope.ts');
const { stableHeight } = await import('../packages/ui/src/utils/stableHeight.ts');
const { visualViewport } = await import('../packages/ui/src/utils/visualViewport.svelte.ts');

const wait = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    observed = new Set<Element>();
    callback: (entries: unknown[]) => void;
    constructor(callback: (entries: unknown[]) => void) {
        this.callback = callback;
        FakeResizeObserver.instances.push(this);
    }
    observe(element: Element) {
        this.observed.add(element);
    }
    unobserve(element: Element) {
        this.observed.delete(element);
    }
    disconnect() {
        this.observed.clear();
    }
}

beforeEach(() => {
    FakeResizeObserver.instances = [];
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('toastStore', () => {
    test('formats every kind of message and hides after the duration', async () => {
        const cases: [unknown, string][] = [
            ['plain', 'plain'],
            [null, ''],
            [new Error('boom'), 'boom'],
            [{ message: 'm' }, 'm'],
            [{ error: 'e' }, 'e'],
            [{ error: { message: 'nested' } }, 'nested'],
            [{ msg: 'short' }, 'short'],
            [{ a: 1 }, '{"a":1}'],
            [{}, '[object Object]'],
            [42, '42']
        ];
        for (const [input, expected] of cases) {
            toastStore.show(input);
            expect(toastStore.message).toBe(expected);
        }
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        toastStore.show(circular);
        expect(toastStore.message).toBe('[object Object]');
    });

    test('exposes the typed shortcuts and auto-hides', async () => {
        toastStore.success('a');
        expect(toastStore.type).toBe('success');
        toastStore.error('b', 10);
        expect(toastStore.type).toBe('error');
        toastStore.warning('c', 10);
        expect(toastStore.type).toBe('warning');
        toastStore.info('d', 10);
        expect(toastStore.type).toBe('info');
        expect(toastStore.visible).toBe(true);
        await wait(40);
        expect(toastStore.visible).toBe(false);
    });
});

describe('scrollStore', () => {
    test('tracks progress and the threshold from window scroll', async () => {
        Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 1500,
            configurable: true
        });
        const stop = scrollStore.init();
        await wait(50);
        expect(scrollStore.pastThreshold).toBe(true);
        expect(scrollStore.progress).toBe(50);
        scrollStore.setContainerProgress(80);
        expect(scrollStore.progress).toBe(80);
        window.dispatchEvent(new window.Event('scroll'));
        window.dispatchEvent(new window.Event('resize'));
        stop?.();
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 100,
            configurable: true
        });
        const again = scrollStore.init();
        await wait(50);
        again?.();
        scrollStore.setContainerProgress(0);
    });
});

describe('platform and reading mode', () => {
    test('detects the platform and toggles reading mode', () => {
        platformStore.detect();
        expect(['mac', 'windows', 'linux', 'other']).toContain(platformStore.current);
        readingModeStore.toggle();
        expect(readingModeStore.active).toBe(true);
        readingModeStore.disable();
        expect(readingModeStore.active).toBe(false);
        readingModeStore.enable();
        expect(readingModeStore.active).toBe(true);
        readingModeStore.disable();
    });
});

describe('file actions', () => {
    test('downloads through a temporary anchor', () => {
        const clicks: string[] = [];
        const original = window.HTMLAnchorElement.prototype.click;
        window.HTMLAnchorElement.prototype.click = function () {
            clicks.push(this.href);
        };
        try {
            downloadUrl('https://dom.test/file.pdf');
        } finally {
            window.HTMLAnchorElement.prototype.click = original;
        }
        expect(clicks).toEqual(['https://dom.test/file.pdf']);
        expect(document.querySelector('a')).toBeNull();
    });

    test('copies text and reports success or failure', async () => {
        const written: string[] = [];
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async (text: string) => void written.push(text) },
            configurable: true
        });
        expect(await copyText('abc', 'Link')).toBe(true);
        expect(written).toEqual(['abc']);
        expect(toastStore.message).toBe('Link copied.');
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async () => Promise.reject(new Error('denied')) },
            configurable: true
        });
        expect(await copyText('abc', 'Link')).toBe(false);
        expect(toastStore.message).toBe('Could not copy the link.');
    });
});

describe('actions', () => {
    test('autoResize follows the content height', async () => {
        const area = document.createElement('textarea');
        document.body.append(area);
        Object.defineProperty(area, 'scrollHeight', { value: 120, configurable: true });
        const action = autoResize(area, 'x');
        await wait(150);
        expect(area.style.height).toBe('120px');
        Object.defineProperty(area, 'scrollHeight', { value: 0, configurable: true });
        area.dispatchEvent(new window.Event('input'));
        expect(area.style.height).toBe('auto');
        area.dispatchEvent(new window.Event('change'));
        FakeResizeObserver.instances[0].callback([]);
        action.update('y');
        await wait(20);
        action.destroy();
    });

    test('staggerChildren numbers children and keeps them numbered', async () => {
        const list = document.createElement('ul');
        list.innerHTML = '<li></li><li></li>';
        document.body.append(list);
        const action = staggerChildren(list);
        expect((list.children[1] as HTMLElement).style.getPropertyValue('--stagger-i')).toBe('1');
        list.append(document.createElement('li'));
        await wait(20);
        expect((list.children[2] as HTMLElement).style.getPropertyValue('--stagger-i')).toBe('2');
        action.destroy();
    });

    test('portal moves a node to a target and back out', () => {
        document.body.innerHTML = '<div id="a"></div><div id="b"></div><p id="n"></p>';
        const node = document.getElementById('n') as HTMLElement;
        const action = portal(node, '#a');
        expect(node.parentElement?.id).toBe('a');
        action.update('#b');
        expect(node.parentElement?.id).toBe('b');
        action.update('#b');
        action.update();
        expect(node.parentElement).toBe(document.body);
        const other = portal(document.createElement('i'), document.getElementById('a')!);
        const fallback = portal(document.createElement('i'), '#missing');
        other.destroy();
        fallback.destroy();
        action.destroy();
        action.destroy();
    });
});

describe('focusScope', () => {
    test('pushes the scope while focused or hovered and pops it afterwards', async () => {
        document.body.innerHTML =
            '<div id="scope"><button id="in"></button></div><button id="out"></button>';
        const node = document.getElementById('scope') as HTMLElement;
        const action = focusScope(node, 'editor');
        const pushed: string[] = [];
        const popped: string[] = [];
        const push = shortcutStore.pushScope;
        const pop = shortcutStore.popScope;
        shortcutStore.pushScope = (scope: string) => (
            pushed.push(scope),
            push.call(shortcutStore, scope)
        );
        shortcutStore.popScope = (scope: string) => (
            popped.push(scope),
            pop.call(shortcutStore, scope)
        );
        try {
            node.dispatchEvent(new window.Event('pointerenter'));
            await wait();
            expect(pushed).toEqual(['editor']);
            action.update('editor');
            action.update('viewer');
            await wait();
            expect(pushed).toEqual(['editor', 'viewer']);
            expect(popped).toEqual(['editor']);
            const inner = document.getElementById('in') as HTMLElement;
            inner.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
            node.dispatchEvent(new window.Event('pointerleave'));
            await wait();
            inner.dispatchEvent(
                new window.FocusEvent('focusout', { bubbles: true, relatedTarget: inner })
            );
            await wait();
            expect(popped).toEqual(['editor']);
            inner.dispatchEvent(
                new window.FocusEvent('focusout', {
                    bubbles: true,
                    relatedTarget: document.getElementById('out')
                })
            );
            await wait();
            expect(popped).toEqual(['editor', 'viewer']);
            node.dispatchEvent(new window.Event('pointerenter'));
            await wait();
            action.destroy();
            await wait();
            expect(popped.at(-1)).toBe('viewer');
        } finally {
            shortcutStore.pushScope = push;
            shortcutStore.popScope = pop;
        }
    });
});

describe('stableHeight', () => {
    test('remembers the skeleton height for the empty state', async () => {
        document.body.innerHTML = '<section id="s"><div aria-busy="true"></div></section>';
        const section = document.getElementById('s') as HTMLElement;
        const busy = section.firstElementChild as HTMLElement;
        busy.getBoundingClientRect = () => ({ height: 90 }) as DOMRect;
        const cleanup = stableHeight(section) as () => void;
        const resize = FakeResizeObserver.instances[0];
        resize.callback([{ borderBoxSize: [{ blockSize: 120 }] }, { borderBoxSize: [] }]);
        busy.remove();
        section.insertAdjacentHTML('beforeend', '<p data-empty-state></p>');
        await wait();
        expect((section.querySelector('[data-empty-state]') as HTMLElement).style.minHeight).toBe(
            '120px'
        );
        section.insertAdjacentHTML('beforeend', '<div aria-busy="true"></div>');
        await wait();
        cleanup();
    });
});

describe('visualViewport', () => {
    test('reads the viewport size and offset when available', () => {
        expect(typeof (visualViewport.height ?? 0)).toBe('number');
        Object.defineProperty(window, 'visualViewport', {
            value: Object.assign(new window.EventTarget(), { height: 400, offsetTop: 12 }),
            configurable: true
        });
        expect(visualViewport.height).toBe(400);
        expect(visualViewport.offsetTop).toBe(12);
        Object.defineProperty(window, 'visualViewport', { value: null, configurable: true });
        expect(visualViewport.height).toBeNull();
        expect(visualViewport.offsetTop).toBeNull();
    });
});
