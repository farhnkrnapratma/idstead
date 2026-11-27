// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import RefineImage from '../packages/ui/src/components/RefineImage.svelte';

const mounted: object[] = [];
const frames: FrameRequestCallback[] = [];
const draws: unknown[][] = [];
const realGetContext = HTMLCanvasElement.prototype.getContext;
const realFrame = window.requestAnimationFrame;

beforeEach(() => {
    draws.length = 0;
    frames.length = 0;
    HTMLCanvasElement.prototype.getContext = (() =>
        ({
            imageSmoothingQuality: 'low',
            imageSmoothingEnabled: true,
            globalAlpha: 1,
            clearRect() {},
            drawImage: (...args: unknown[]) => draws.push(args)
        }) as unknown as CanvasRenderingContext2D) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    window.requestAnimationFrame = (callback => {
        frames.push(callback);
        return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.requestAnimationFrame = window.requestAnimationFrame;
});

afterEach(() => {
    for (const instance of mounted.splice(0)) void unmount(instance);
    document.body.innerHTML = '';
    HTMLCanvasElement.prototype.getContext = realGetContext;
    window.requestAnimationFrame = realFrame;
    globalThis.requestAnimationFrame = realFrame;
    delete document.documentElement.dataset.reduceMotion;
});

async function settle() {
    for (let round = 0; round < 3; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
}

function render(props: Record<string, unknown>) {
    mounted.push(
        mount(RefineImage as never, { target: document.body, props: { alt: 'Banner', ...props } })
    );
    flushSync();
    const img = document.querySelector('img');
    if (!img) throw new Error('image missing');
    return img;
}

function loadImage(img: HTMLImageElement, style: Partial<CSSStyleDeclaration> = {}) {
    Object.defineProperty(img, 'naturalWidth', { value: 1600, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 900, configurable: true });
    Object.assign(img.style, style);
    img.dispatchEvent(new Event('load'));
    flushSync();
}

function runFrames() {
    let now = 0;
    let guard = 0;
    while (frames.length && guard++ < 500) {
        now += 16;
        frames.shift()?.(now);
    }
}

test('a loaded image refines through the pixel levels to the sharp image', async () => {
    document.documentElement.dataset.reduceMotion = 'false';
    let loaded = 0;
    const img = render({ src: 'https://cdn.test/banner.png', onload: () => loaded++ });
    loadImage(img, { objectFit: 'cover', objectPosition: '25% 75%' });

    expect(loaded).toBe(1);
    expect(frames.length).toBe(1);
    runFrames();
    expect(draws.length).toBeGreaterThan(8);
    expect(draws.some(args => args[0] === img)).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 250));
    await settle();
    expect(document.querySelector('canvas')).toBeNull();
});

test('contained images are letterboxed while they refine', () => {
    document.documentElement.dataset.reduceMotion = 'false';
    const img = render({ src: 'https://cdn.test/logo.png' });
    loadImage(img, { objectFit: 'contain', objectPosition: '0% 100%' });
    runFrames();
    expect(draws.length).toBeGreaterThan(0);
});

test('reduced motion shows the image at once', () => {
    document.documentElement.dataset.reduceMotion = 'true';
    const img = render({ src: 'https://cdn.test/plain.png' });
    loadImage(img);
    expect(frames).toHaveLength(0);
    expect(draws).toHaveLength(0);
});

test('without a reduce-motion choice the system setting decides', () => {
    const img = render({ src: 'https://cdn.test/system.png' });
    loadImage(img);
    expect(frames.length).toBeLessThanOrEqual(1);
});

test('a failed source set falls back to src, then to the placeholder', async () => {
    let failed = 0;
    const img = render({
        src: 'https://cdn.test/missing.png',
        variant: 'avatar',
        sources: [{ srcset: 'https://cdn.test/missing.avif', type: 'image/avif' }],
        onerror: () => failed++
    });
    expect(document.querySelector('picture')).not.toBeNull();
    img.dispatchEvent(new Event('error'));
    await settle();
    expect(document.querySelector('picture')).toBeNull();
    expect(failed).toBe(0);

    document.querySelector('img')?.dispatchEvent(new Event('error'));
    await settle();
    expect(failed).toBe(1);
    expect(document.querySelector('svg')).not.toBeNull();
});

test('an image that is already cached shows at once without the reveal', () => {
    const prototype = HTMLImageElement.prototype;
    const complete = Object.getOwnPropertyDescriptor(prototype, 'complete');
    const naturalWidth = Object.getOwnPropertyDescriptor(prototype, 'naturalWidth');
    Object.defineProperty(prototype, 'complete', { get: () => true, configurable: true });
    Object.defineProperty(prototype, 'naturalWidth', { get: () => 640, configurable: true });
    try {
        let loaded = 0;
        render({ src: 'https://cdn.test/cached.png', onload: () => loaded++ });
        expect(loaded).toBe(1);
        expect(frames).toHaveLength(0);
        expect(document.querySelector('canvas')).toBeNull();
    } finally {
        if (complete) Object.defineProperty(prototype, 'complete', complete);
        else delete (prototype as { complete?: boolean }).complete;
        if (naturalWidth) Object.defineProperty(prototype, 'naturalWidth', naturalWidth);
        else delete (prototype as { naturalWidth?: number }).naturalWidth;
    }
});
