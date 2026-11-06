// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, test } from 'bun:test';
import {
    highlightAfterScroll,
    lockScroll,
    preferredScrollBehavior,
    scrollToBottom,
    scrollToTop,
    whenScrollSettles
} from '../packages/ui/src/utils/scroll.ts';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

afterEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.reduceMotion;
});

describe('lockScroll', () => {
    test('nests locks and restores styles on the last release, once per lock', () => {
        document.body.style.overflow = 'auto';
        Object.defineProperty(window, 'innerWidth', { value: 1015, configurable: true });
        Object.defineProperty(document.documentElement, 'clientWidth', {
            value: 1000,
            configurable: true
        });
        const first = lockScroll();
        const second = lockScroll();
        expect(document.body.style.overflow).toBe('hidden');
        expect(document.body.style.paddingRight).toBe('15px');
        first();
        first();
        expect(document.body.style.overflow).toBe('hidden');
        second();
        expect(document.body.style.overflow).toBe('auto');
        expect(document.body.style.paddingRight).toBe('');
    });

    test('skips padding when there is no scrollbar', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
        const release = lockScroll();
        expect(document.body.style.paddingRight).toBe('');
        release();
    });
});

describe('scroll behaviour and jumping', () => {
    test('prefers instant scrolling when motion is reduced', () => {
        expect(preferredScrollBehavior()).toBe('smooth');
        document.documentElement.dataset.reduceMotion = 'true';
        expect(preferredScrollBehavior()).toBe('auto');
    });

    test('scrolls the article, main and window to the top and bottom', () => {
        document.body.innerHTML =
            '<article class="article-scroll-container"></article><main id="main"></main>';
        const calls: string[] = [];
        for (const element of [
            document.querySelector('article'),
            document.getElementById('main')
        ] as HTMLElement[]) {
            Object.defineProperty(element, 'scrollTop', { value: 10, configurable: true });
            Object.defineProperty(element, 'scrollHeight', { value: 500, configurable: true });
            Object.defineProperty(element, 'clientHeight', { value: 100, configurable: true });
            element.scrollTo = ((options: ScrollToOptions) =>
                calls.push(`${element.tagName}:${options.top}`)) as never;
        }
        window.scrollTo = ((options: ScrollToOptions) =>
            calls.push(`window:${options.top}`)) as never;
        scrollToTop('auto');
        scrollToBottom('auto');
        expect(calls).toContain('ARTICLE:0');
        expect(calls).toContain('MAIN:0');
        expect(calls).toContain('window:0');
        expect(calls).toContain('ARTICLE:500');
        expect(calls).toContain('MAIN:500');
    });

    test('leaves containers alone when nothing overflows', () => {
        document.body.innerHTML =
            '<article class="article-scroll-container"></article><main id="main"></main>';
        const calls: string[] = [];
        window.scrollTo = ((options: ScrollToOptions) =>
            calls.push(`window:${options.top}`)) as never;
        scrollToTop();
        scrollToBottom();
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every(call => call.startsWith('window'))).toBe(true);
    });
});

describe('whenScrollSettles', () => {
    test('finishes after the grace period when nothing scrolls', async () => {
        let done = 0;
        whenScrollSettles(window, () => done++);
        await wait(160);
        expect(done).toBe(1);
    });

    test('waits for the scroll to go idle and ignores a second finish', async () => {
        let done = 0;
        const scroller = document.createElement('div');
        whenScrollSettles(scroller, () => done++);
        scroller.dispatchEvent(new window.Event('scroll'));
        await wait(130);
        expect(done).toBe(0);
        await wait(80);
        expect(done).toBe(1);
        scroller.dispatchEvent(new window.Event('scrollend'));
        expect(done).toBe(1);
    });

    test('finishes on scrollend and can be cancelled', async () => {
        let done = 0;
        const scroller = document.createElement('div');
        whenScrollSettles(scroller, () => done++);
        scroller.dispatchEvent(new window.Event('scrollend'));
        expect(done).toBe(1);

        const cancel = whenScrollSettles(scroller, () => done++);
        cancel();
        await wait(160);
        expect(done).toBe(1);
    });
});

describe('highlightAfterScroll', () => {
    test('highlights the target after scrolling settles and clears the previous one', async () => {
        document.body.innerHTML =
            '<p class="footnote-target-highlight" id="old"></p><sup><a id="t"></a></sup>';
        const target = document.getElementById('t') as HTMLElement;
        const cancel = highlightAfterScroll(target);
        expect(
            document.getElementById('old')?.classList.contains('footnote-target-highlight')
        ).toBe(false);
        await wait(160);
        expect(target.closest('sup')?.classList.contains('footnote-target-highlight')).toBe(true);
        cancel();
        expect(target.closest('sup')?.classList.contains('footnote-target-highlight')).toBe(false);
    });
});
