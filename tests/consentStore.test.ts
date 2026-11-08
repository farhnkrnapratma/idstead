// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { consentStore } from '../apps/web/src/lib/stores/consentStore.svelte.ts';

const KEY = 'idstead_cookie_consent_v2';
const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const realGtag = window.gtag;
const realDataLayer = window.dataLayer;

let memory: Map<string, string>;
let gtagCalls: unknown[][];

function installStorage(overrides: Partial<Storage> = {}) {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => memory.get(key) ?? null,
            setItem: (key: string, value: string) => void memory.set(key, value),
            removeItem: (key: string) => void memory.delete(key),
            ...overrides
        }
    });
}

beforeEach(() => {
    memory = new Map();
    gtagCalls = [];
    installStorage();
    window.gtag = undefined;
    window.dataLayer = [];
    consentStore.resetVisitorConsent();
    window.dataLayer = [];
});

afterEach(() => {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    window.gtag = realGtag;
    window.dataLayer = realDataLayer;
});

test('opens the banner on a first visit and leaves it alone when consent is stored', () => {
    consentStore.init();
    expect(consentStore.isBannerOpen).toBe(true);
    consentStore.closeBanner();
    memory.set(
        KEY,
        JSON.stringify({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'x' })
    );
    consentStore.init();
    expect(consentStore.isBannerOpen).toBe(false);
});

test('restores saved signals and treats unknown values as denied', () => {
    memory.set(
        KEY,
        JSON.stringify({
            analytics_storage: 'granted',
            ad_storage: 'granted',
            ad_user_data: 'maybe',
            ad_personalization: 'granted'
        })
    );
    consentStore.closeBanner();
    consentStore.init();
    expect(consentStore.signals).toMatchObject({
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'denied',
        ad_personalization: 'granted'
    });
    expect(consentStore.isBannerOpen).toBe(false);
});

test('opens the banner when stored consent cannot be read', () => {
    installStorage({
        getItem: () => {
            throw new Error('blocked');
        }
    });
    consentStore.init();
    expect(consentStore.isBannerOpen).toBe(true);
});

test('accepting all grants every signal and saves them', () => {
    consentStore.acceptAll();
    expect(consentStore.isBannerOpen).toBe(false);
    expect(consentStore.signals.analytics_storage).toBe('granted');
    expect(JSON.parse(memory.get(KEY) ?? 'null')).toMatchObject({
        analytics_storage: 'granted',
        ad_personalization: 'granted'
    });
});

test('accepting analytics only grants analytics and denies advertising', () => {
    consentStore.acceptAnalyticsOnly();
    expect(consentStore.signals).toMatchObject({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    });
});

test('rejecting all denies every signal', () => {
    consentStore.acceptAll();
    consentStore.rejectAll();
    expect(consentStore.signals.analytics_storage).toBe('denied');
    expect(consentStore.signals.ad_personalization).toBe('denied');
});

test('pushes the update to gtag when it is loaded, otherwise to the data layer', () => {
    window.gtag = (...args: unknown[]) => void gtagCalls.push(args);
    consentStore.acceptAll();
    expect(gtagCalls.at(-1)?.[0]).toBe('consent');
    expect(window.dataLayer.length).toBe(0);

    window.gtag = undefined;
    consentStore.rejectAll();
    expect(window.dataLayer.at(-1)).toEqual([
        'consent',
        'update',
        {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        }
    ]);
});

test('keeps consent working when storage refuses writes or removals', () => {
    installStorage({
        setItem: () => {
            throw new Error('full');
        },
        removeItem: () => {
            throw new Error('blocked');
        }
    });
    consentStore.acceptAnalyticsOnly();
    expect(consentStore.signals.analytics_storage).toBe('granted');
    consentStore.resetVisitorConsent();
    expect(consentStore.isBannerOpen).toBe(true);
});

test('manages the customize dialog and the banner visibility', () => {
    consentStore.openCustomizeModal();
    expect(consentStore.isCustomizeModalOpen).toBe(true);
    consentStore.closeCustomizeModal();
    expect(consentStore.isCustomizeModalOpen).toBe(false);
    consentStore.isCustomizeModalOpen = true;
    expect(consentStore.isCustomizeModalOpen).toBe(true);
    consentStore.closeBanner();
    expect(consentStore.isBannerOpen).toBe(false);
});

test('resetting clears saved consent and reopens the banner', () => {
    consentStore.acceptAll();
    consentStore.openCustomizeModal();
    consentStore.resetVisitorConsent();
    expect(memory.has(KEY)).toBe(false);
    expect(consentStore.isCustomizeModalOpen).toBe(false);
    expect(consentStore.isBannerOpen).toBe(true);
    expect(consentStore.signals.analytics_storage).toBe('denied');
});
