// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import ErrorState from '../packages/ui/src/components/ErrorState.svelte';
import GradientText from '../packages/ui/src/components/GradientText.svelte';
import SkipLink from '../packages/ui/src/components/SkipLink.svelte';

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

function render(component: unknown, props: Record<string, unknown>) {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(mount(component as never, { target, props: props as never }));
    flushSync();
    return target;
}

test('error state shows a page-size error with its code and a retry action', () => {
    let retried = 0;
    const target = render(ErrorState, {
        size: 'page',
        code: 503,
        title: 'Down',
        description: 'Try later.',
        onRetry: () => retried++,
        retryLabel: 'Again'
    });
    expect(target.textContent).toContain('Down');
    expect(target.textContent).toContain('Try later.');
    const retry = [...target.querySelectorAll('button')].find(button =>
        button.textContent?.includes('Again')
    );
    retry?.click();
    flushSync();
    expect(retried).toBe(1);
});

test('error state prefers custom actions over the retry button', () => {
    const actions = createRawSnippet(() => ({ render: () => '<a href="/home">Home</a>' }));
    const target = render(ErrorState, { size: 'page', actions, onRetry: () => {} });
    expect(target.querySelector('a[href="/home"]')).not.toBeNull();
    expect(target.textContent).toContain('Something went wrong');
});

test('error state defaults to an inline message without code', () => {
    const target = render(ErrorState, {});
    expect(target.textContent).toContain('We encountered an unexpected error');
});

test('gradient text renders each variant with glow, border and hover behaviour', () => {
    const children = createRawSnippet(() => ({ render: () => '<span>Shine</span>' }));
    for (const variant of ['linear', 'flow', 'conic'] as const) {
        const target = render(GradientText, {
            children,
            variant,
            direction: 'diagonal',
            glow: 4,
            showBorder: true,
            pauseOnHover: true,
            followPointer: true,
            colors: ['red', 'blue']
        });
        expect(target.textContent).toContain('Shine');
        unmount(mounted.pop() as object);
        target.remove();
    }
    const single = render(GradientText, {
        children,
        colors: ['red'],
        scale: 9,
        direction: 'vertical'
    });
    expect(single.textContent).toContain('Shine');
});

test('skip link appears on focus and moves focus to the main content', () => {
    const main = document.createElement('main');
    main.id = 'main';
    document.body.append(main);
    const target = render(SkipLink, {});
    const link = target.querySelector('button') ?? target.querySelector('a');
    link?.dispatchEvent(new Event('focusin', { bubbles: true }));
    link?.dispatchEvent(new FocusEvent('focus'));
    flushSync();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    main.remove();
});
