// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { a11yStore } from '../packages/ui/src/stores/a11yStore.svelte.ts';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const ContentCard = (
    (await import('../apps/web/src/lib/components/ContentCard.svelte')) as { default: never }
).default;
const AccessibilitySelect = (
    (await import('../packages/ui/src/components/filter/AccessibilitySelect.svelte')) as {
        default: never;
    }
).default;

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

test('content card shows its image, badges, description and tags', () => {
    const meta = createRawSnippet(() => ({ render: () => '<span>Meta line</span>' }));
    const tagItem = createRawSnippet((tag: () => string) => ({
        render: () => `<span>#${tag()}</span>`
    }));
    const target = render(ContentCard, {
        title: 'Hello world',
        href: '/blog/hello',
        external: true,
        pinned: true,
        isNew: true,
        description: 'An excerpt',
        image: { url: 'https://cdn.example.com/banner.webp', alt: 'Banner' },
        tags: ['svelte', 'tests', 'css', 'deno', 'bun'],
        maxTags: 3,
        meta,
        tagItem,
        tagHref: (tag: string) => `/tags/${tag}`,
        tagAriaLabel: (tag: string) => `Tag ${tag}`,
        tagNoun: 'tag',
        pinnedLabel: 'Pinned',
        newLabel: 'New'
    });
    expect(target.textContent).toContain('Hello world');
    expect(target.textContent).toContain('An excerpt');
    expect(target.textContent).toContain('Meta line');
    expect(target.textContent).toContain('opens in new tab');
    expect(target.textContent).toContain('+2');
});

test('content card without optional parts still links to its page', () => {
    const target = render(ContentCard, { title: 'Plain', href: '/about' });
    expect(target.querySelector('a')?.getAttribute('href')).toBe('/about');
});

test('accessibility menu opens and adjusts the font scale within its limits', () => {
    a11yStore.setFontScale(100 as never);
    const target = render(AccessibilitySelect, {});
    const trigger = target.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]');
    if (!trigger) throw new Error('accessibility trigger missing');
    trigger.click();
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const adjust = (label: string) =>
        [...target.ownerDocument.querySelectorAll<HTMLButtonElement>('button')].find(button =>
            (button.getAttribute('aria-label') ?? button.textContent ?? '').includes(label)
        );
    adjust('Increase')?.click();
    flushSync();
    expect(a11yStore.current.fontScale).toBeGreaterThanOrEqual(100);
    adjust('Decrease')?.click();
    flushSync();
    expect(a11yStore.current.fontScale).toBeGreaterThanOrEqual(100);
    document
        .querySelector<HTMLButtonElement>('[aria-label="Close accessibility selector"]')
        ?.click();
    flushSync();
});
