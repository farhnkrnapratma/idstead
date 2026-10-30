import { describe, expect, test } from 'bun:test';

const globalCss = await Bun.file(
    new URL('../packages/ui/src/styles/global.css', import.meta.url)
).text();
const appLayout = await Bun.file(
    new URL('../apps/web/src/routes/+layout.svelte', import.meta.url)
).text();
const tableOfContents = await Bun.file(
    new URL('../apps/web/src/lib/components/TableOfContents.svelte', import.meta.url)
).text();

describe('A11y focus highlight', () => {
    test('uses the high-visibility outline for all focused public page elements', () => {
        expect(globalCss).toMatch(
            /:root\[data-focus-highlight='true'\]:not\(\[data-admin-page='true'\]\)\s*:focus:not\(main\)\s*\{/
        );
        expect(globalCss).toMatch(/main:focus\s*\{\s*@apply outline-none;/);
        expect(globalCss).toContain(
            'rounded-md ring-0! ring-offset-0! outline-4! outline-offset-4! outline-highlight! outline-solid!'
        );
    });

    test('prevents disclosure and table-of-contents containers from clipping focus', () => {
        expect(globalCss).toMatch(/details:has\(:focus\)\s*\{\s*overflow: visible !important;/);
        expect(tableOfContents).toContain('overflow-y-auto px-2 py-2');
        expect(globalCss).toContain('scroll-padding: 0.5rem;');
        expect(globalCss).toContain('scroll-margin: 0.5rem;');
    });

    test('excludes admin pages, which live in their own app', async () => {
        const adminHtml = await Bun.file(
            new URL('../apps/admin/src/app.html', import.meta.url)
        ).text();
        const webHtml = await Bun.file(new URL('../apps/web/src/app.html', import.meta.url)).text();
        expect(adminHtml).toContain('data-admin-page="true"');
        expect(webHtml).not.toContain('data-admin-page');
        expect(appLayout).not.toContain('dataset.adminPage');
    });
});
