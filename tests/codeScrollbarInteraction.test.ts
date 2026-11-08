// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createCodeScrollbar } from '../packages/mdrs/dom/src/codeScrollbar.ts';

type Handler = (event: Record<string, unknown>) => void;

function recording(width = 100) {
    const handlers: Record<string, Handler[]> = {};
    const children: unknown[] = [];
    return {
        className: '',
        style: {} as Record<string, string>,
        children,
        isConnected: true,
        scrollLeft: 0,
        scrollWidth: 400,
        clientWidth: 200,
        appendChild: (child: unknown) => children.push(child),
        addEventListener: (type: string, handler: Handler) => {
            (handlers[type] ??= []).push(handler);
        },
        removeEventListener: () => {},
        dispatch(type: string, event: Record<string, unknown> = {}) {
            for (const handler of handlers[type] ?? []) handler(event);
        },
        setPointerCapture: () => {},
        releasePointerCapture: () => {},
        hasPointerCapture: () => true,
        getBoundingClientRect: () => ({ left: 0, width })
    };
}

type Recorder = ReturnType<typeof recording>;

const globals = globalThis as Record<string, unknown>;
const saved = {
    document: globals.document,
    window: globals.window,
    ResizeObserver: globals.ResizeObserver
};
let windowHandlers: Record<string, Handler[]> = {};

beforeAll(() => {
    globals.document = { createElement: () => recording(), body: { style: {} } };
    globals.window = {
        addEventListener: (type: string, handler: Handler) => {
            (windowHandlers[type] ??= []).push(handler);
        },
        removeEventListener: () => {}
    };
    delete globals.ResizeObserver;
});

afterAll(() => {
    for (const [key, value] of Object.entries(saved))
        if (value === undefined) delete globals[key];
        else globals[key] = value;
});

function bar(options: Parameters<typeof createCodeScrollbar>[1] = {}) {
    const scroller = recording() as unknown as HTMLElement;
    const handle = createCodeScrollbar(scroller, options);
    const wrapper = handle.element as unknown as Recorder;
    const track = wrapper.children[0] as Recorder;
    const thumb = track.children[0] as Recorder;
    return { scroller: scroller as unknown as Recorder, handle, track, thumb };
}

describe('code scrollbar interactions', () => {
    test('clicking the track scrolls to the matching position', () => {
        const { scroller, handle, track } = bar();
        handle.update();
        track.dispatch('pointerdown', { clientX: 50, target: track });
        expect(scroller.scrollLeft).toBe(100);
    });

    test('dragging the thumb scrolls and releasing ends the drag', () => {
        const { scroller, handle, thumb } = bar();
        handle.update();
        thumb.dispatch('pointerdown', { clientX: 10, pointerId: 1, preventDefault: () => {} });
        thumb.dispatch('pointermove', { clientX: 30 });
        const dragged = scroller.scrollLeft;
        expect(dragged).toBeGreaterThan(0);
        thumb.dispatch('pointerup', { pointerId: 1 });
        thumb.dispatch('pointermove', { clientX: 90 });
        expect(scroller.scrollLeft).toBe(dragged);
    });

    test('pointer cancel ends a drag like pointer up', () => {
        const { scroller, handle, thumb } = bar();
        handle.update();
        thumb.dispatch('pointerdown', { clientX: 0, pointerId: 2, preventDefault: () => {} });
        thumb.dispatch('pointercancel', { pointerId: 2 });
        thumb.dispatch('pointermove', { clientX: 60 });
        expect(scroller.scrollLeft).toBe(0);
    });

    test('ignores track clicks when nothing overflows', () => {
        const { scroller, handle, track } = bar();
        scroller.scrollWidth = 150;
        handle.update();
        track.dispatch('pointerdown', { clientX: 50, target: track });
        expect(scroller.scrollLeft).toBe(0);
    });

    test('falls back to the window resize event without ResizeObserver', () => {
        windowHandlers = {};
        let resized = 0;
        const { scroller, handle } = bar({ onResize: () => resized++ });
        const handler = windowHandlers.resize?.[0];
        expect(handler).toBeDefined();
        handler?.({});
        expect(resized).toBe(1);
        scroller.isConnected = false;
        handler?.({});
        expect(resized).toBe(1);
        handle.destroy();
    });

    test('observes resizes and disconnects once the scroller leaves the page', () => {
        let observerCallback: (() => void) | undefined;
        let disconnected = false;
        globals.ResizeObserver = class {
            constructor(callback: () => void) {
                observerCallback = callback;
            }
            observe() {}
            disconnect() {
                disconnected = true;
            }
        };
        try {
            let resized = 0;
            const { scroller, handle } = bar({ onResize: () => resized++ });
            observerCallback?.();
            expect(resized).toBe(1);
            scroller.isConnected = false;
            observerCallback?.();
            expect(disconnected).toBe(true);
            handle.destroy();
        } finally {
            delete globals.ResizeObserver;
        }
    });
});
