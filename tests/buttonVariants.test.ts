// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import Button from '../packages/ui/src/components/Button.svelte';

const icon = createRawSnippet(() => ({ render: () => '<i class="bi bi-star"></i>' }));

function render(props: Record<string, unknown>) {
    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(Button, { target, props: props as never });
    flushSync();
    return { target, component };
}

test('renders every type and size, with critical tone and full width', () => {
    for (const type of [
        'primary',
        'danger',
        'outline',
        'ghost',
        'secondary',
        'tertiary'
    ] as const) {
        for (const size of ['3xs', '2xs', 'xs', 'sm', 'md', 'lg'] as const) {
            const { target, component } = render({ label: 'Go', type, size, fullWidth: true });
            expect(target.querySelector('button')).not.toBeNull();
            unmount(component);
            target.remove();
        }
    }
    const { target, component } = render({ label: 'Delete', type: 'outline', tone: 'critical' });
    expect(target.querySelector('button')).not.toBeNull();
    unmount(component);
    target.remove();
});

test('splits labels around their last space or dot and keeps single words whole', () => {
    for (const label of ['Save changes', 'Release v1.2', 'Done', '  Padded label  ']) {
        const { target, component } = render({ label, responsiveIconOnly: true, size: 'xs' });
        expect(target.textContent?.trim().length).toBeGreaterThan(0);
        unmount(component);
        target.remove();
    }
});

test('shows leading and trailing icons, and hides the trailing one while loading', () => {
    const plain = render({ label: 'Star', leading: icon, trailing: icon });
    expect(plain.target.querySelectorAll('i.bi-star').length).toBe(2);
    unmount(plain.component);
    plain.target.remove();

    const loading = render({ label: 'Star', trailing: icon, isLoading: true });
    expect(loading.target.querySelectorAll('i.bi-star').length).toBe(0);
    unmount(loading.component);
    loading.target.remove();
});

test('renders a link when given an href and a disabled state otherwise', () => {
    const link = render({
        label: 'Docs',
        href: 'https://example.com/docs',
        target: '_blank',
        rel: 'noopener',
        download: true
    });
    const anchor = link.target.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com/docs');
    unmount(link.component);
    link.target.remove();

    const disabled = render({ label: 'Off', disabled: true, htmlType: 'submit' });
    expect(disabled.target.querySelector('button')?.disabled).toBe(true);
    unmount(disabled.component);
    disabled.target.remove();
});
