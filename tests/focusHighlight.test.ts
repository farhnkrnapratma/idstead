import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'bun:test';

const globalCss = readFileSync(
  new URL('../src/routes/global.css', import.meta.url),
  'utf8'
);
const appLayout = readFileSync(
  new URL('../src/routes/+layout.svelte', import.meta.url),
  'utf8'
);
const tableOfContents = readFileSync(
  new URL('../src/lib/components/TableOfContents.svelte', import.meta.url),
  'utf8'
);

describe('A11y focus highlight', () => {
  test('uses the high-visibility outline for all focused public page elements', () => {
    expect(globalCss).toMatch(
      /:root\[data-focus-highlight='true'\]:not\(\[data-admin-page='true'\]\)\s*:focus\s*\{/
    );
    expect(globalCss).toContain(
      'rounded-md ring-0! ring-offset-0! outline-4! outline-offset-4! outline-a11y-focus! outline-solid!'
    );
  });

  test('prevents disclosure and table-of-contents containers from clipping focus', () => {
    expect(globalCss).toMatch(
      /details:has\(:focus\)\s*\{\s*overflow: visible !important;/
    );
    expect(tableOfContents).toContain('overflow-y-auto px-2 py-2');
    expect(globalCss).toContain('scroll-padding: 0.5rem;');
    expect(globalCss).toContain('scroll-margin: 0.5rem;');
  });

  test('excludes admin pages as routes change', () => {
    expect(appLayout).toContain(
      "document.documentElement.dataset.adminPage = 'true'"
    );
    expect(appLayout).toContain(
      'delete document.documentElement.dataset.adminPage'
    );
    expect(appLayout).toContain("destinationPath.startsWith('/admin')");
  });
});
