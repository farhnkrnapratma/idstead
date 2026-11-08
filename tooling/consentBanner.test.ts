// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));
Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};

const ConsentBanner = (
    (await import('../apps/web/src/lib/components/ConsentBanner.svelte')) as { default: never }
).default;
const { consentStore } = await import('../apps/web/src/lib/stores/consentStore.svelte.ts');

const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        element => element.textContent?.trim() === label
    );

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('lets a visitor accept, narrow or refuse cookies from the banner', async () => {
    consentStore.resetVisitorConsent();
    mounted.push(mount(ConsentBanner, { target: document.body, props: {} as never }));
    await settle();
    expect(document.querySelector('aside')).not.toBeNull();

    button('Accept all')?.click();
    await settle();
    expect(consentStore.isBannerOpen).toBe(false);
    expect(consentStore.signals.ad_personalization).toBe('granted');

    consentStore.resetVisitorConsent();
    await settle();
    button('Analytics only')?.click();
    await settle();
    expect(consentStore.signals).toMatchObject({
        analytics_storage: 'granted',
        ad_storage: 'denied'
    });

    consentStore.resetVisitorConsent();
    await settle();
    button('Reject all')?.click();
    await settle();
    expect(consentStore.signals.analytics_storage).toBe('denied');
});

test('opens the customize dialog and applies a quick preset', async () => {
    consentStore.resetVisitorConsent();
    mounted.push(mount(ConsentBanner, { target: document.body, props: {} as never }));
    await settle();

    button('Cookie settings')?.click();
    await settle();
    expect(consentStore.isCustomizeModalOpen).toBe(true);

    const preset = document.querySelector<HTMLInputElement>('input[type="range"]');
    if (!preset) throw new Error('quick preset slider missing');
    preset.value = '0';
    preset.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(consentStore.isCustomizeModalOpen).toBe(true);
    consentStore.closeCustomizeModal();
    await settle();
    expect(consentStore.isCustomizeModalOpen).toBe(false);
});

test('dismisses the banner from its close control', async () => {
    consentStore.resetVisitorConsent();
    mounted.push(mount(ConsentBanner, { target: document.body, props: {} as never }));
    await settle();
    document.querySelector<HTMLButtonElement>('[aria-label="Dismiss banner"]')?.click();
    await settle();
    expect(consentStore.isBannerOpen).toBe(false);
});
