// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';
import Button from '../packages/ui/src/components/Button.svelte';

test('renders a button', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(Button, { target, props: { label: 'Go' } });
    flushSync();
    expect(target.querySelector('button')).not.toBeNull();
    unmount(component);
});
