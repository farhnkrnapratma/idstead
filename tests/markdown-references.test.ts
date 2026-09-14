import {expect, test} from 'bun:test';
import {prepareMarkdownPage, renderMarkdown} from '../src/lib/markdown';
import {extractReferences} from '../src/lib/markdownReferences';

test('references render at the directive with one visible heading and working backlinks', async () => {
  const markdown =
    '## Footnotes\n\nFirst[^a], repeated[^a], math[^math].\n\n:::references\n[^a]: A **source**.\n[^math]: Math source.\n:::\n\n## After';
  const {html, headings} = await prepareMarkdownPage(markdown);
  expect(headings.map(h => h.text)).toEqual([
    'Footnotes',
    'References',
    'After'
  ]);
  expect(html.indexOf('class="footnotes"')).toBeLessThan(
    html.indexOf('id="after"')
  );
  expect(html).toContain('href="#footnote-ref-a"');
  expect(html).toContain('href="#footnote-ref-a-2"');
  expect(html).toContain('<strong>source</strong>');
  expect(html).not.toContain('REFERENCESPLACEMENT');
  expect(await renderMarkdown(markdown)).toContain('>References</h2>');
});

test('legacy headings remain while the plugin heading stays out of the ToC', async () => {
  const {headings, html} = await prepareMarkdownPage(
    '## Footnotes\n\nText[^a].\n\n## References\n\n[^a]: Source.'
  );
  expect(headings.map(h => h.text)).toEqual(['Footnotes', 'References']);
  expect(html).toContain('aria-describedby="footnote-label"');
  expect(html).toContain('class="sr-only">Footnotes</h2>');
});

test('code examples and unclosed code fences do not execute references directives', async () => {
  for (const fence of ['```', '~~~~']) {
    const markdown = `${fence}markdown\n:::references\n[^a]: Example.\n:::\n${fence}`;
    expect(extractReferences(markdown).marker).toBeNull();
    expect((await prepareMarkdownPage(markdown)).headings).toEqual([]);
    expect(
      extractReferences(markdown.slice(0, -fence.length)).marker
    ).toBeNull();
  }
});

test('references validation handles duplicate blocks, missing closing delimiter and empty blocks', async () => {
  expect(() => extractReferences(':::references\n[^a]: Source.')).toThrow(
    'Close the references block'
  );
  expect(() =>
    extractReferences(':::references\n:::\n:::references\n:::')
  ).toThrow('only one references block');
  expect(
    (await prepareMarkdownPage(':::references\n:::')).headings.map(h => h.text)
  ).toEqual(['References']);
});

test('reference rendering does not leak definitions between documents', async () => {
  const rendered = await Promise.all(
    ['Alpha', 'Beta'].map(name =>
      prepareMarkdownPage(`Text[^a].\n\n:::references\n[^a]: ${name}.\n:::`)
    )
  );
  expect(rendered[0].html).toContain('Alpha.');
  expect(rendered[0].html).not.toContain('Beta.');
  expect(rendered[1].html).toContain('Beta.');
  expect(rendered[1].html).not.toContain('Alpha.');
});
