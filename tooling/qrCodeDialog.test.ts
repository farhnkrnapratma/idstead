// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const QrCodeDialog = (
    (await import('../apps/web/src/lib/components/QrCodeDialog.svelte')) as { default: never }
).default;

const mounted: object[] = [];
const copied: string[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('renders the code for a page and copies or downloads it', async () => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                copied.push(text);
            }
        }
    });
    mounted.push(
        mount(QrCodeDialog, {
            target: document.body,
            props: {
                isOpen: true,
                url: 'https://example.com/blog/hello',
                slug: 'hello',
                onClose: () => {}
            } as never
        })
    );
    await settle();
    expect(document.body.textContent).toContain('Scan QR code');

    const control = (label: string) =>
        [...document.querySelectorAll<HTMLButtonElement>('button')].find(
            element => element.textContent?.trim() === label
        );
    control('Copy')?.click();
    await settle();
    control('Download')?.click();
    await settle();
    expect(document.body.textContent).toContain('Scan QR code');
});
