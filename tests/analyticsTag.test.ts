// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    analyticsHead,
    analyticsSources,
    siteAnalytics
} from '../packages/lib/src/server/analytics.ts';

const appHtml = await Bun.file(new URL('../apps/web/src/app.html', import.meta.url)).text();

describe('analytics tag', () => {
    test('declares UTF-8 before scripts within the first 1024 bytes', () => {
        const charsetIndex = appHtml.indexOf('<meta charset="utf-8" />');
        const firstScriptIndex = appHtml.indexOf('<script>');
        expect(charsetIndex).toBeGreaterThanOrEqual(0);
        expect(charsetIndex + '<meta charset="utf-8" />'.length).toBeLessThanOrEqual(1024);
        expect(charsetIndex).toBeLessThan(firstScriptIndex);
    });

    test('the shell holds a placeholder instead of a provider script', () => {
        expect(appHtml).toContain('%idstead.analytics%');
        expect(appHtml).not.toContain('googletagmanager');
        expect(appHtml).not.toContain('gtag');
    });

    test('no provider means no script', () => {
        expect(analyticsHead({ provider: 'none' }, 'example.com')).toBe('');
        expect(analyticsSources({ provider: 'none' })).toEqual({
            script: [],
            connect: [],
            img: []
        });
    });

    test('Umami Cloud may send events to its gateway, self-hosted Umami to its own host', () => {
        expect(
            analyticsSources({
                provider: 'umami',
                websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e',
                scriptUrl: 'https://cloud.umami.is/script.js'
            }).connect
        ).toEqual(['https://cloud.umami.is', 'https://gateway.umami.is']);
        expect(
            analyticsSources({
                provider: 'umami',
                websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e',
                scriptUrl: 'https://stats.example.com/script.js'
            }).connect
        ).toEqual(['https://stats.example.com']);
    });

    test('GA4 sets denied consent defaults before loading the tag', () => {
        const head = analyticsHead({ provider: 'ga4', measurementId: 'G-ABC123' }, 'example.com');
        const defaults = head.indexOf("gtag('consent', 'default', consent)");
        expect(defaults).toBeGreaterThan(head.indexOf("analytics_storage: 'denied'"));
        expect(head.indexOf("gtag('config', 'G-ABC123')")).toBeGreaterThan(defaults);
        expect(head).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123');
        expect(head).toContain("localStorage.getItem('idstead_cookie_consent_v2')");
    });

    test('GTM loads its container after the consent defaults', () => {
        const head = analyticsHead({ provider: 'gtm', containerId: 'GTM-ABC1234' }, 'example.com');
        expect(head.indexOf('gtm.js?id=GTM-ABC1234')).toBeGreaterThan(
            head.indexOf("gtag('consent', 'default', consent)")
        );
    });

    test('cookieless providers load one deferred script with escaped attributes', () => {
        expect(
            analyticsHead(
                {
                    provider: 'umami',
                    websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e',
                    scriptUrl: 'https://stats.example.com/script.js?a=1&b=2'
                },
                'example.com'
            )
        ).toBe(
            '<script defer src="https://stats.example.com/script.js?a=1&amp;b=2" data-website-id="0f8fad5b-d9cb-469f-a165-70867728950e"></script>'
        );
        expect(
            analyticsHead(
                { provider: 'plausible', scriptUrl: 'https://plausible.io/js/script.js' },
                'example.com'
            )
        ).toContain('data-domain="example.com"');
        expect(
            analyticsHead({ provider: 'cloudflare', token: 'a'.repeat(32) }, 'example.com')
        ).toContain(`data-cf-beacon='{"token": "${'a'.repeat(32)}"}'`);
    });

    test('CSP sources follow the provider', () => {
        expect(
            analyticsSources({
                provider: 'plausible',
                scriptUrl: 'https://plausible.io/js/script.js'
            })
        ).toEqual({ script: ['https://plausible.io'], connect: ['https://plausible.io'], img: [] });
        expect(analyticsSources({ provider: 'ga4', measurementId: 'G-ABC123' }).script).toEqual([
            'https://www.googletagmanager.com'
        ]);
    });

    test('consent is needed only for providers that set cookies, and a failed read loads nothing', async () => {
        const repos = (value: unknown) => ({ site: { analytics: async () => value as never } });
        expect(
            (await siteAnalytics(repos({ provider: 'ga4', measurementId: 'G-ABC123' }))).consent
        ).toBe(true);
        expect(
            (await siteAnalytics(repos({ provider: 'cloudflare', token: 'a'.repeat(32) }))).consent
        ).toBe(false);
        const failing = await siteAnalytics({
            site: {
                analytics: async () => {
                    throw new Error('down');
                }
            }
        });
        expect(failing).toEqual({ settings: { provider: 'none' }, consent: false });
    });
});
