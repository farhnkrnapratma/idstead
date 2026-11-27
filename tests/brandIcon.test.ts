// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import BrandIcon from '../packages/lib/src/components/BrandIcon.svelte';

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) void unmount(instance);
    document.body.innerHTML = '';
});

async function render(props: Record<string, string>) {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(mount(BrandIcon as never, { target, props }));
    for (let round = 0; round < 6; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
    return target;
}

test('a Bootstrap icon name renders an i element with its classes', async () => {
    const target = await render({ icon: 'github', class: 'size-4' });
    const icon = target.querySelector('i');
    expect(icon?.className).toContain('bi bi-github');
    expect(icon?.className).toContain('size-4');
});

test('a Lucide tag loads the matching icon with its allowed props', async () => {
    const target = await render({ icon: '<ExternalLink size={20} onclick="x" />' });
    const svg = target.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('lucide-external-link');
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.hasAttribute('onclick')).toBe(false);
});

test('an unknown Lucide icon falls back to the Bootstrap fallback', async () => {
    const target = await render({ icon: '<NoSuchIconAnywhere />', fallback: 'bi-link' });
    expect(target.querySelector('svg')).toBeNull();
    expect(target.querySelector('i')?.className).toContain('bi bi-link');
});

test('an unknown Lucide icon without a fallback renders nothing', async () => {
    const target = await render({ icon: '<NoSuchIconAnywhere />' });
    expect(target.querySelector('i, svg')).toBeNull();
});

test('an empty icon uses the fallback, and no input renders nothing', async () => {
    expect(
        (await render({ icon: '  ', fallback: 'globe' })).querySelector('i')?.className
    ).toContain('bi bi-globe');
    expect((await render({})).children).toHaveLength(0);
});
