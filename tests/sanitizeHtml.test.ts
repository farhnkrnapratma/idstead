import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'bun:test';
import {sanitizeHtml} from '../src/lib/sanitizeHtml';
import {renderMarkdown, renderMarkdownUnsafe} from '../src/lib/markdown';

describe('sanitizeHtml: hostile input', () => {
  test.each([
    ['script', '<p>a</p><script>alert(1)</script><p>b</p>', 'alert'],
    ['inline handler', '<img src=x onerror=alert(1)>', 'onerror'],
    ['quoted handler', '<a href="/x" onclick="alert(1)">x</a>', 'onclick'],
    ['javascript href', '<a href="javascript:alert(1)">x</a>', 'javascript'],
    [
      'entity scheme',
      '<a href="javascript&colon;alert(1)">x</a>',
      'javascript:'
    ],
    [
      'numeric entity',
      '<a href="&#106;avascript:alert(1)">x</a>',
      'javascript:'
    ],
    ['tab in scheme', '<a href="java&Tab;script:alert(1)">x</a>', 'script:'],
    ['data href', '<a href="data:text/html,<b>x</b>">x</a>', 'data:'],
    ['svg onload', '<svg onload=alert(1)></svg>', 'onload'],
    ['style tag', '<style>*{display:none}</style>x', 'display'],
    ['foreign iframe', '<iframe src="https://evil.test"></iframe>', 'evil'],
    [
      'srcdoc',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      'srcdoc'
    ],
    ['object', '<object data="x"></object>', 'object'],
    [
      'meta refresh',
      '<meta http-equiv="refresh" content="0;url=//evil">',
      'meta'
    ],
    ['form', '<form action="//evil"><button>go</button></form>', 'form'],
    [
      'math mtext trick',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      'onerror'
    ],
    ['unterminated tag', '<img src=x onerror=alert(1)', '<img'],
    ['comment', '<!-- <script>alert(1)</script> -->ok', 'alert'],
    ['uppercase', '<IMG SRC=x ONERROR=alert(1)>', 'onerror'],
    [
      'position takeover',
      '<div class="fixed inset-0 z-50 bg-white">x</div>',
      'fixed'
    ],
    ['style position', '<span style="position:fixed;top:0">x</span>', 'fixed'],
    [
      'style url',
      '<span style="color:url(javascript:alert(1))">x</span>',
      'javascript'
    ]
  ])('%s', (_name, input, forbidden) => {
    expect(sanitizeHtml(input).toLowerCase()).not.toContain(forbidden);
  });

  test('keeps text content when dropping unknown tags', () => {
    expect(sanitizeHtml('<custom>kept</custom>')).toBe('kept');
  });

  test('stray angle brackets are escaped', () => {
    expect(sanitizeHtml('1 < 2 and <3')).toBe('1 &lt; 2 and &lt;3');
  });

  test('external links are forced to noopener', () => {
    const html = sanitizeHtml(
      '<a href="https://x.test" target="_blank" rel="opener">x</a>'
    );
    expect(html).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>'
    );
  });

  test('allowed embeds survive and foreign ones do not', () => {
    const ok =
      '<iframe src="https://www.youtube.com/embed/abc_123" loading="lazy" allowfullscreen class="h-full" title="Embedded content"></iframe>';
    expect(sanitizeHtml(ok)).toContain('youtube.com/embed/abc_123');
    expect(
      sanitizeHtml(
        '<iframe src="https://www.youtube.com.evil.test/embed/a"></iframe>'
      )
    ).toBe('');
    expect(
      sanitizeHtml(
        '<iframe src="https://codepen.io/u/embed/xyz?default-tab=result"></iframe>'
      )
    ).toContain('codepen.io/u/embed/xyz');
  });

  test('unbalanced markup is closed so layout cannot leak', () => {
    expect(sanitizeHtml('<div><span>x')).toBe('<div><span>x</span></div>');
    expect(sanitizeHtml('x</div></span>')).toBe('x');
  });

  test('is idempotent', () => {
    const input =
      '<p class="a b">x <a href="/y?a=1&b=2" title="t&quot;q">l</a><svg viewBox="0 0 1 1"><path d="M0 0"/></svg></p>';
    const once = sanitizeHtml(input);
    expect(sanitizeHtml(once)).toBe(once);
  });

  test('does not backtrack on long adversarial input', () => {
    const started = performance.now();
    sanitizeHtml(`<a ${'a=1 '.repeat(20000)}`);
    sanitizeHtml(`<${'a'.repeat(50000)}`);
    sanitizeHtml('<p '.repeat(20000));
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('sanitizeHtml: engine output', () => {
  const markdown = readFileSync(
    new URL('./fixtures/markdown-demo.md', import.meta.url),
    'utf8'
  );

  const tally = (source: string) => {
    const html = source.replaceAll('&amp;', '&');
    const counts = new Map<string, number>();
    const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
    for (const tag of html.matchAll(
      /<([a-zA-Z][\w:-]*)((?:\s[^<>]*?)?)\/?>/g
    )) {
      const name = tag[1].toLowerCase();
      bump(name);
      for (const attr of tag[2].matchAll(/\s([^\s"'<>/=]+)=/g)) {
        bump(`${name}@${attr[1]}`);
      }
      for (const cls of tag[2].matchAll(/\sclass="([^"]*)"/g)) {
        for (const token of cls[1].split(/\s+/).filter(Boolean)) {
          bump(`${name}.${token}`);
        }
      }
    }
    return counts;
  };

  test('every tag, attribute and class the engine emits survives', async () => {
    const before = tally(await renderMarkdownUnsafe(markdown));
    const after = tally(await renderMarkdown(markdown));
    const lost = [...before].filter(([key, count]) => after.get(key) !== count);
    expect(lost).toEqual([]);
  });

  test('the markers the client enhancers rely on survive', async () => {
    const html = await renderMarkdown(markdown);
    for (const marker of [
      'markdown-alert',
      'markdown-callout',
      'markdown-details',
      'markdown-tabs-container',
      'markdown-tab-group',
      'markdown-steps-container',
      'data-tab-label=',
      'data-tab-group-key="bundler"',
      'mermaid-raw-code',
      'data-content=',
      'data-chart-content=',
      'katex-mathml',
      'katex-html',
      'data-filename="auth.svelte.ts"',
      'data-highlight-lines="2,5,6,7"',
      'https://www.youtube.com/embed/',
      '<kbd>',
      '<sub>',
      '<sup>',
      '<u>',
      '<mark>',
      'class="footnotes"'
    ]) {
      expect(html).toContain(marker);
    }
  });

  test('raw html in a post is neutralised end to end', async () => {
    const html = await renderMarkdown(
      'hi <img src=x onerror=alert(1)> <a href="javascript:alert(2)">x</a>\n\n<script>alert(3)</script>\n\n<svg onload=alert(4)></svg>'
    );
    expect(html).not.toMatch(/onerror|onload|<script|javascript:/i);
  });

  test('author html that the engine itself relies on stays usable', async () => {
    const html = await renderMarkdown(
      '<details><summary>More</summary>\n\nbody\n\n</details>\n\nPress <kbd>Ctrl</kbd>'
    );
    expect(html).toContain('markdown-details');
    expect(html).toContain('<kbd>Ctrl</kbd>');
  });
});
