import { describe, expect, test } from 'bun:test';

const appHtml = await Bun.file(new URL('../apps/web/src/app.html', import.meta.url)).text();

describe('Google Analytics tag', () => {
    test('declares UTF-8 before scripts within the first 1024 bytes', () => {
        const charsetIndex = appHtml.indexOf('<meta charset="utf-8" />');
        const firstScriptIndex = appHtml.indexOf('<script>');
        const charsetEnd = charsetIndex + '<meta charset="utf-8" />'.length;

        expect(charsetIndex).toBeGreaterThanOrEqual(0);
        expect(charsetEnd).toBeLessThanOrEqual(1024);
        expect(charsetIndex).toBeLessThan(firstScriptIndex);
    });

    test('loads the configured GA4 property after setting consent defaults', () => {
        const defaultsIndex = appHtml.indexOf("gtag('consent', 'default', defaultConsent)");
        const idIndex = appHtml.indexOf("'%sveltekit.env.PUBLIC_GA_MEASUREMENT_ID%'");
        const configIndex = appHtml.indexOf("gtag('config', measurementId)");
        const scriptIndex = appHtml.indexOf('https://www.googletagmanager.com/gtag/js?id=');

        expect(idIndex).toBeGreaterThan(defaultsIndex);
        expect(appHtml).toContain('if (/^G-[A-Z0-9]+$/.test(measurementId))');
        expect(appHtml).not.toMatch(/G-[A-Z0-9]{6,}/);

        expect(defaultsIndex).toBeGreaterThanOrEqual(0);
        expect(configIndex).toBeGreaterThan(defaultsIndex);
        expect(scriptIndex).toBeGreaterThan(configIndex);
        expect(appHtml).toContain("analytics_storage: 'denied'");
        expect(appHtml).toContain("ad_storage: 'denied'");
        expect(appHtml).toContain("ad_user_data: 'denied'");
        expect(appHtml).toContain("ad_personalization: 'denied'");
        expect(appHtml).not.toContain('GTM-TSBRHB6V');
        expect(appHtml).not.toContain('googletagmanager.com/ns.html');
    });
});
