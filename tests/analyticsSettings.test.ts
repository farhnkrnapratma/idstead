import { describe, expect, mock, test } from 'bun:test';
import {
    AnalyticsSettingsError,
    analyticsFacts,
    parseAnalyticsSettings,
    storedAnalyticsSettings
} from '../packages/domain/src/analytics.ts';

mock.module('$app/env/public', () => ({}));

const { getAnalytics } = await import('../packages/lib/src/server/api/analytics.ts');
const { runApi } = await import('../packages/lib/src/server/api/responses.ts');

function field(input: unknown) {
    try {
        parseAnalyticsSettings(input);
    } catch (error) {
        return error instanceof AnalyticsSettingsError ? error.field : 'other';
    }
    return null;
}

describe('analytics settings', () => {
    test('accepts each provider with valid IDs', () => {
        expect(parseAnalyticsSettings({ provider: 'ga4', measurementId: ' G-ABC123XYZ ' })).toEqual(
            { provider: 'ga4', measurementId: 'G-ABC123XYZ' }
        );
        expect(parseAnalyticsSettings({ provider: 'gtm', containerId: 'GTM-ABC1234' })).toEqual({
            provider: 'gtm',
            containerId: 'GTM-ABC1234'
        });
        expect(
            parseAnalyticsSettings({
                provider: 'umami',
                websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e'
            })
        ).toEqual({
            provider: 'umami',
            websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e',
            scriptUrl: 'https://cloud.umami.is/script.js'
        });
        expect(
            parseAnalyticsSettings({
                provider: 'plausible',
                scriptUrl: 'https://stats.example.com/js/script.js'
            })
        ).toEqual({ provider: 'plausible', scriptUrl: 'https://stats.example.com/js/script.js' });
        expect(parseAnalyticsSettings({ provider: 'cloudflare', token: 'a'.repeat(32) })).toEqual({
            provider: 'cloudflare',
            token: 'a'.repeat(32)
        });
        expect(parseAnalyticsSettings({ provider: 'none', measurementId: 'G-X' })).toEqual({
            provider: 'none'
        });
    });

    test('rejects bad IDs and unsafe script URLs by field', () => {
        expect(field({ provider: 'ga4', measurementId: 'UA-1234' })).toBe('measurementId');
        expect(field({ provider: 'gtm', containerId: 'G-1234' })).toBe('containerId');
        expect(field({ provider: 'umami', websiteId: 'nope' })).toBe('websiteId');
        expect(field({ provider: 'cloudflare', token: 'xyz' })).toBe('token');
        expect(field({ provider: 'facebook' })).toBe('provider');
        expect(field(null)).toBe('provider');
        for (const scriptUrl of [
            'http://stats.example.com/script.js',
            'https://user:pass@stats.example.com/script.js',
            'https://stats.example.com/script.js#x',
            'https://stats.example.com/script.php',
            'javascript:alert(1)'
        ])
            expect(field({ provider: 'plausible', scriptUrl })).toBe('scriptUrl');
    });

    test('a stored value that fails validation reads as none', () => {
        expect(storedAnalyticsSettings({ provider: 'ga4', measurementId: 'x' })).toEqual({
            provider: 'none'
        });
    });

    test('public facts say which provider runs and whether it sets cookies', () => {
        expect(analyticsFacts({ provider: 'none' })).toEqual({
            enabled: false,
            provider: 'none',
            name: 'None',
            cookies: false
        });
        expect(analyticsFacts({ provider: 'gtm', containerId: 'GTM-ABC1234' }).cookies).toBe(true);
        expect(analyticsFacts({ provider: 'cloudflare', token: 'a'.repeat(32) }).cookies).toBe(
            false
        );
    });
});

describe('GET /v1/analytics', () => {
    const ctx = (path: string, analytics: () => Promise<unknown>) =>
        ({
            url: new URL(`https://api.example.com${path}`),
            request: new Request(`https://api.example.com${path}`),
            repos: { site: { analytics } },
            fetch
        }) as never;

    test('returns the facts without IDs', async () => {
        const response = await runApi(() =>
            getAnalytics(
                ctx('/v1/analytics', async () => ({ provider: 'ga4', measurementId: 'G-ABC123' }))
            )
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
            enabled: true,
            provider: 'ga4',
            name: 'Google Analytics 4',
            cookies: true
        });
        expect(JSON.stringify(body)).not.toContain('G-ABC123');
    });

    test('rejects parameters and reports storage failures', async () => {
        const unknown = await runApi(() =>
            getAnalytics(ctx('/v1/analytics?id=1', async () => ({ provider: 'none' })))
        );
        expect(unknown.status).toBe(400);
        const failing = await runApi(() =>
            getAnalytics(
                ctx('/v1/analytics', async () => {
                    throw new Error('down');
                })
            )
        );
        expect(failing.status).toBe(500);
        expect((await failing.json()).code).toBe('ANALYTICS_FETCH_FAILED');
    });
});
