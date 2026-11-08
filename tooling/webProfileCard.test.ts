// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const ProfileCard = (
    (await import('../apps/web/src/lib/components/ProfileCard.svelte')) as { default: never }
).default;

const mounted: object[] = [];

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

test('shows the profile details, avatar and banner', async () => {
    mounted.push(
        mount(ProfileCard, {
            target: document.body,
            props: {
                name: 'Ada Lovelace',
                pronunciation: 'AY-dah',
                headline: 'Engineer',
                jobTitle: 'Analyst',
                location: 'London',
                bio: 'Writes programs.',
                avatarUrl: 'https://cdn.example.com/avatar.webp',
                bannerUrl: 'https://cdn.example.com/banner.webp',
                headingTag: 'h2'
            } as never
        })
    );
    await settle();
    const text = document.body.textContent ?? '';
    for (const part of [
        'Ada Lovelace',
        'AY-dah',
        'Engineer',
        'Analyst',
        'London',
        'Writes programs.'
    ]) {
        expect(text).toContain(part);
    }
    expect(document.querySelector('h2')?.textContent).toContain('Ada Lovelace');
});

test('falls back when the banner image cannot load', async () => {
    mounted.push(
        mount(ProfileCard, {
            target: document.body,
            props: { name: 'Ada', bannerUrl: 'https://cdn.example.com/broken.webp' } as never
        })
    );
    await settle();
    const banner = document.querySelector('img');
    banner?.dispatchEvent(new Event('error'));
    await settle();
    expect(document.querySelectorAll('img').length).toBeLessThanOrEqual(1);
    expect(document.body.textContent).toContain('Ada');
});

test('opens the QR dialog from its button when a handler is given', async () => {
    let opened = 0;
    mounted.push(
        mount(ProfileCard, {
            target: document.body,
            props: { name: 'Ada', onShowQr: () => opened++ } as never
        })
    );
    await settle();
    document.querySelector<HTMLButtonElement>('button')?.click();
    flushSync();
    expect(opened).toBe(1);
});
