// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createTechText, type TechTextSettings } from '../packages/ui/src/utils/techText.ts';

const scope = globalThis as unknown as Record<string, any>;

function alphaPattern(length: number) {
    const data = new Uint8ClampedArray(length);
    for (let index = 0; index < length; index += 4) {
        const pixel = index / 4;
        data[index + 3] = pixel % 7 < 4 ? 255 : 0;
    }
    return data;
}

function fakeContext(canvas: HTMLCanvasElement) {
    const store: Record<string | symbol, unknown> = {};
    return new Proxy(
        {},
        {
            get(_, key) {
                if (key === 'canvas') return canvas;
                if (key in store) return store[key];
                if (key === 'measureText')
                    return (text: string) => ({
                        width: String(text).length * 10,
                        actualBoundingBoxAscent:
                            text === 'd' ? ascender
                            : text === 'H' ? capital
                            : 12,
                        actualBoundingBoxDescent: 4,
                        actualBoundingBoxLeft: 0,
                        actualBoundingBoxRight: String(text).length * 10
                    });
                if (key === 'getImageData')
                    return (_x: number, _y: number, w: number, h: number) => ({
                        data: alphaPattern(w * h * 4),
                        width: w,
                        height: h
                    });
                if (key === 'createLinearGradient' || key === 'createRadialGradient')
                    return () => ({ addColorStop() {} });
                return () => undefined;
            },
            set(_, key, value) {
                store[key] = value;
                return true;
            },
            has: () => true
        }
    );
}

class FakeObserver {
    static instances: FakeObserver[] = [];
    callback: (entries: Array<{ isIntersecting: boolean }>) => void;
    disconnected = false;
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        this.callback = callback;
        FakeObserver.instances.push(this);
    }
    observe() {}
    disconnect() {
        this.disconnected = true;
    }
}

let clock = 0;
let ascender = 40;
let capital = 20;
let frames: Array<(time: number) => void> = [];
let nextFrame = 1;
const natives = {
    raf: scope.requestAnimationFrame,
    caf: scope.cancelAnimationFrame,
    now: performance.now.bind(performance),
    resize: scope.ResizeObserver,
    intersection: scope.IntersectionObserver,
    getContext: HTMLCanvasElement.prototype.getContext,
    fonts: Object.getOwnPropertyDescriptor(document, 'fonts')
};

function run(count: number, step = 16) {
    for (let index = 0; index < count; index++) {
        clock += step;
        const batch = frames;
        frames = [];
        for (const frame of batch) frame(clock);
    }
}

beforeEach(() => {
    clock = 1000;
    ascender = 40;
    capital = 20;
    frames = [];
    FakeObserver.instances = [];
    scope.requestAnimationFrame = (callback: (time: number) => void) => {
        frames.push(callback);
        return nextFrame++;
    };
    scope.cancelAnimationFrame = () => {
        frames = [];
    };
    performance.now = () => clock;
    scope.ResizeObserver = FakeObserver;
    scope.IntersectionObserver = FakeObserver;
    HTMLCanvasElement.prototype.getContext = function () {
        const holder = this as unknown as { _ctx?: unknown };
        holder._ctx ??= fakeContext(this);
        return holder._ctx as never;
    };
    document.body.innerHTML = '';
});

afterEach(() => {
    scope.requestAnimationFrame = natives.raf;
    scope.cancelAnimationFrame = natives.caf;
    performance.now = natives.now;
    scope.ResizeObserver = natives.resize;
    scope.IntersectionObserver = natives.intersection;
    HTMLCanvasElement.prototype.getContext = natives.getContext;
    if (natives.fonts) Object.defineProperty(document, 'fonts', natives.fonts);
    else delete scope.document.fonts;
});

const base: TechTextSettings = {
    text: 'Hello',
    fontFamily: '',
    fontWeight: 600,
    fontSize: 96,
    letterSpacing: 0.02,
    color: 'currentColor',
    accentColor: 'var(--accent)',
    align: 'center',
    reach: 120,
    softness: 0.5,
    dashLength: 6,
    dashGap: 4,
    strokeWidth: 1.5,
    lineStyle: 'dashed',
    reveal: 'area',
    specks: 12,
    selection: true,
    labels: true,
    draggable: true,
    bounce: 0.6,
    sweep: true,
    speed: 1,
    clickKick: true,
    intro: 'none',
    introDuration: 1.2,
    guides: true
};

function mountTechText(overrides: Partial<TechTextSettings> = {}, size = [480, 160]) {
    const container = document.createElement('div');
    container.style.color = 'rgb(10, 20, 30)';
    container.style.setProperty('--accent', '#ff3366');
    Object.defineProperty(container, 'clientWidth', { value: size[0] });
    Object.defineProperty(container, 'clientHeight', { value: size[1] });
    container.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            right: size[0],
            bottom: size[1],
            width: size[0],
            height: size[1],
            x: 0,
            y: 0
        }) as DOMRect;
    const canvas = document.createElement('canvas');
    container.append(canvas);
    document.body.append(container);
    const settings = { ...base, ...overrides };
    const handle = createTechText(container, canvas, () => settings);
    const show = (visible = true) => {
        for (const observer of FakeObserver.instances)
            observer.callback([{ isIntersecting: visible }]);
    };
    const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
        container.dispatchEvent(
            new window.PointerEvent(type, {
                clientX: x,
                clientY: y,
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                bubbles: true,
                ...init
            })
        );
    return { container, canvas, handle, settings, show, pointer };
}

describe('createTechText', () => {
    test('returns inert controls without a canvas context', () => {
        HTMLCanvasElement.prototype.getContext = () => null;
        const { handle } = mountTechText();
        handle.wake();
        handle.destroy();
    });

    test('draws frames while visible and stops when hidden', () => {
        const view = mountTechText();
        view.show();
        run(5);
        view.show(false);
        run(3);
        expect(frames).toHaveLength(0);
        view.handle.destroy();
    });

    test('responds to the pointer across the word', () => {
        const view = mountTechText();
        view.show();
        run(20);
        for (let x = 20; x < 480; x += 20) {
            view.pointer('pointermove', x, 80);
            run(2);
        }
        view.pointer('pointerenter', 100, 80);
        view.pointer('pointerdown', 100, 80);
        run(2);
        view.pointer('pointermove', 140, 100);
        run(5);
        view.pointer('pointerup', 140, 100);
        run(30);
        view.pointer('pointerleave', 0, 0);
        run(60);
        view.handle.destroy();
    });

    test('drags letters found by scanning the canvas', () => {
        const view = mountTechText({ softness: 0, text: 'Hello' });
        view.show();
        run(40);
        for (let x = 150; x < 340; x += 10) {
            for (let y = 20; y < 150; y += 10) {
                view.pointer('pointerdown', x, y);
                view.pointer('pointermove', x + 30, y + 20);
                run(4);
                view.pointer('pointerup', x + 30, y + 20);
                run(2);
            }
        }
        run(80);
        view.handle.destroy();
    });

    test('kicks a letter on a quick click', () => {
        const view = mountTechText({ draggable: false });
        view.show();
        run(30);
        view.pointer('pointerdown', 240, 80);
        view.pointer('pointerup', 240, 80);
        run(60);
        view.pointer('pointerdown', 240, 80, { pointerType: 'touch', button: -1 });
        view.pointer('pointercancel', 400, 140);
        view.pointer('pointerdown', 240, 80, { button: 2 });
        run(5);
        view.handle.destroy();
    });

    test('plays every intro and reveal style', () => {
        for (const intro of ['type', 'assemble', 'metrics'] as const) {
            for (const reveal of ['area', 'letter', 'off'] as const) {
                const view = mountTechText({ intro, reveal });
                view.show();
                run(10);
                view.pointer('pointermove', 200, 80);
                view.pointer('pointerdown', 200, 80);
                run(150);
                view.pointer('pointerup', 200, 80);
                run(30);
                view.handle.destroy();
            }
        }
    });

    test('supports alternate alignments and styles', () => {
        ascender = 12;
        capital = 12;
        for (const align of ['left', 'center', 'right'] as const) {
            for (const lineStyle of ['dashed', 'solid'] as const) {
                const view = mountTechText({
                    align,
                    lineStyle,
                    labels: false,
                    guides: false,
                    selection: false,
                    sweep: false,
                    specks: 0,
                    text: 'Wide text sample'
                });
                view.show();
                view.pointer('pointermove', 100, 60);
                run(40);
                view.handle.destroy();
            }
        }
    });

    test('resizes and reacts to theme changes', () => {
        const view = mountTechText({}, [10, 10]);
        view.show();
        for (const observer of FakeObserver.instances)
            observer.callback([{ isIntersecting: true }]);
        document.documentElement.dataset.reduceMotion = 'true';
        run(10);
        view.pointer('pointerdown', 5, 5);
        view.pointer('pointerup', 5, 5);
        delete document.documentElement.dataset.reduceMotion;
        view.handle.wake();
        run(5);
        view.handle.destroy();
        expect(FakeObserver.instances.some(observer => observer.disconnected)).toBe(true);
    });

    test('waits for fonts when the font loading API exists', async () => {
        const loaded: string[] = [];
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                load: (font: string) => {
                    loaded.push(font);
                    return Promise.resolve([]);
                },
                ready: Promise.resolve()
            }
        });
        const view = mountTechText({ fontFamily: 'Custom Face' });
        view.show();
        run(3);
        await Promise.resolve();
        await Promise.resolve();
        run(3);
        expect(loaded.length).toBeGreaterThan(0);
        view.handle.destroy();
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                load: () => Promise.reject(new Error('x')),
                ready: Promise.reject(new Error('x'))
            }
        });
        const failing = mountTechText();
        failing.show();
        await Promise.resolve();
        await Promise.resolve();
        run(3);
        failing.handle.destroy();
    });
});
