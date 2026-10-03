import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'bun:test';
import {
  convertLegacyMarkdown as convert,
  convertLegacyMarkdownWithNotes
} from '../src/lib/legacyMarkdown';
import {renderMarkdown} from '../src/lib/markdown';

describe('alerts', () => {
  test('multi-line and single-line alerts become directives', () => {
    expect(convert('> [!NOTE]\n> first\n> second\n\nafter')).toBe(
      ':::note\nfirst\nsecond\n:::\n\nafter'
    );
    expect(convert('> [!IMPORTANT] one line text')).toBe(
      ':::important\none line text\n:::'
    );
    expect(convert('> [!warning]\n>\n> para two')).toBe(
      ':::warning\n\npara two\n:::'
    );
  });

  test('alerts inside list items keep their indentation', () => {
    expect(convert('- item\n\n  > [!TIP]\n  > inner')).toBe(
      '- item\n\n  :::tip\n  inner\n  :::'
    );
  });

  test('a plain blockquote is not touched', () => {
    expect(convert('> just a quote')).toBe('> just a quote');
  });
});

describe('directives', () => {
  test('callout and embed lose their braces', () => {
    expect(convert(':::callout{title="Hi" icon="zap"}\nx\n:::')).toBe(
      ':::callout title="Hi" icon="zap"\nx\n:::'
    );
    expect(convert(':::callout{title="Hi", icon="zap"}\nx\n:::')).toBe(
      ':::callout title="Hi" icon="zap"\nx\n:::'
    );
    expect(convert(':::embed{url="https://youtu.be/abc"}')).toBe(
      ':::embed url="https://youtu.be/abc"'
    );
  });

  test('old code tabs become snippets and tab-group becomes tabs at once', () => {
    const legacy = [
      ':::tabs{key="pm"}',
      '::tab{label="bun" icon="terminal"}',
      '```bash',
      'bun add x',
      '```',
      '::',
      ':::',
      '',
      ':::tab-group{key="r"}',
      '::tab{label="SSR"}',
      'text',
      '::',
      ':::'
    ].join('\n');
    expect(convert(legacy)).toBe(
      [
        ':::snippets key="pm"',
        '::tab label="bun" icon="terminal"',
        '```bash',
        'bun add x',
        '```',
        '::',
        ':::',
        '',
        ':::tabs',
        '::tab label="SSR"',
        'text',
        '::',
        ':::'
      ].join('\n')
    );
  });

  test('old tabs without a key are detected by their tab syntax', () => {
    expect(convert(':::tabs\n::tab{label="a"}\nx\n::\n:::')).toBe(
      ':::snippets\n::tab label="a"\nx\n::\n:::'
    );
  });

  test('new content tabs are never rewritten', () => {
    const modern = ':::tabs\n::tab label="a"\nx\n::\n:::';
    expect(convert(modern)).toBe(modern);
  });

  test('details html becomes a details directive, nested included', () => {
    const legacy =
      '<details>\n<summary>What <code>is</code> it?</summary>\n\nouter\n\n<details open>\n<summary>Inner</summary>\n\ndeep\n\n</details>\n\n</details>';
    expect(convert(legacy)).toBe(
      ':::details summary="What is it?"\n\nouter\n\n:::details summary="Inner"\n\ndeep\n\n:::\n\n:::'
    );
  });

  test('summary quotes are escaped', () => {
    expect(
      convert('<details><summary>say "hi"</summary>\n\nx\n\n</details>')
    ).toBe(':::details summary="say \\"hi\\""\n\nx\n\n:::');
  });

  test('raw video becomes the media syntax', () => {
    expect(
      convert(
        '<video controls preload="metadata" src="/blog/content/a.mp4"></video>'
      )
    ).toBe('![Video](/blog/content/a.mp4)');
  });
});

describe('math', () => {
  test('inline forms become $$ ... $$', () => {
    expect(convert('Let $x^2$ and \\(y\\) be.')).toBe(
      'Let $$ x^2 $$ and $$ y $$ be.'
    );
  });

  test('display forms become :::math', () => {
    expect(convert('$$\n\\int x\n$$')).toBe(':::math\n\\int x\n:::');
    expect(convert('\\[\na+b\n\\]')).toBe(':::math\na+b\n:::');
    expect(convert('$$ E = mc^2 $$')).toBe(':::math\nE = mc^2\n:::');
  });

  test('a single-line $$ in the middle of a sentence stays inline', () => {
    expect(convert('Euler $$ e^{i\\pi} $$ is nice.')).toBe(
      'Euler $$ e^{i\\pi} $$ is nice.'
    );
  });

  test('interpolation, inline code, fences and :::define are protected', () => {
    const doc = [
      ':::define',
      'price: "$5"',
      ':::',
      '',
      '[${email}](mailto:${email}) and `$x$`',
      '',
      '```',
      '$y$ and $$z$$',
      '```'
    ].join('\n');
    expect(convert(doc)).toBe(doc);
  });

  test('documents that already use the new syntax keep their dollars', () => {
    const modern =
      ':::note\nIt costs $5 and $10.\n:::\n\nInline $$ x $$ here.\n\n$$ y $$';
    expect(convert(modern)).toBe(modern);
  });
});

describe('code fences', () => {
  test('line markers move to mark=', () => {
    expect(convert('```typescript {2,5-7}\na\n```')).toBe(
      '```typescript mark=2,5..7\na\n```'
    );
    expect(convert('```ts{1}\na\n```')).toBe('```ts mark=1\na\n```');
  });

  test('four-backtick fences keep their example content untouched', () => {
    const doc = '````markdown\n> [!NOTE]\n> example $x$\n```ts {1}\n```\n````';
    expect(convert(doc)).toBe(doc);
  });
});

describe('removed directives', () => {
  test('a leading config block is stripped', () => {
    const result = convertLegacyMarkdownWithNotes(
      ':::config\ntranslate: false\n:::\n\n:::define\na: 1\n:::\n\nbody'
    );
    expect(result.markdown).toBe(':::define\na: 1\n:::\n\nbody');
    expect(result.notes.join()).toContain('config');
  });

  test('locale blocks are kept for the content locale and dropped otherwise', () => {
    const doc =
      ':::locale{only="en"}\nEnglish\n:::\n\n:::locale{only="id"}\nIndonesia\n:::';
    expect(convert(doc, {locale: 'en'})).toBe('English\n\n');
    expect(convert(doc, {locale: 'id'})).toBe('\n\nIndonesia');
    expect(convertLegacyMarkdownWithNotes(doc).notes.join()).toContain(
      'dropped'
    );
  });

  test('ignore-translate is unwrapped and overrides use their default text', () => {
    expect(convert(':::ignore-translate\nKeep me\n:::')).toBe('Keep me');
    expect(
      convert(
        ':::translate-override\nDefault text\n::override{locale="id"}\nTeks\n:::'
      )
    ).toBe('Default text');
  });
});

describe('whole documents', () => {
  const legacy = [
    ':::config',
    'translate: false',
    ':::',
    '',
    '# Title',
    '',
    '> [!NOTE]',
    '> Read **this**.',
    '',
    ':::callout{title="Log" icon="list"}',
    'v1',
    ':::',
    '',
    ':::tabs{key="pm"}',
    '::tab{label="bun"}',
    '```bash {1}',
    'bun add x',
    '```',
    '::',
    ':::',
    '',
    'Euler $e^{i\\pi}+1=0$ and:',
    '',
    '$$',
    '\\int_0^1 x\\,dx',
    '$$',
    '',
    '<details><summary>More</summary>',
    '',
    'hidden',
    '',
    '</details>'
  ].join('\n');

  test('conversion is idempotent', () => {
    const once = convert(legacy);
    expect(convert(once)).toBe(once);
  });

  test('the converted document leaves no old syntax and renders cleanly', async () => {
    const converted = convert(legacy);
    for (const old of [
      '[!NOTE]',
      '{title=',
      '::tab{',
      ':::tabs{',
      '<details',
      ':::config',
      '{1}'
    ]) {
      expect(converted).not.toContain(old);
    }
    const html = await renderMarkdown(converted);
    expect(html).toContain('markdown-alert-note');
    expect(html).toContain('markdown-callout');
    expect(html).toContain('markdown-tabs-container');
    expect(html).toContain('katex-block');
    expect(html).toContain('markdown-details');
    expect(html).toContain('data-highlight-lines="1"');
    expect(html).not.toContain(':::');
  });

  test('a document already in the new syntax is unchanged', () => {
    const modern = readFileSync(
      new URL('./fixtures/markdown-demo.md', import.meta.url),
      'utf8'
    );
    expect(convert(modern)).toBe(modern);
  });

  test('legal-page shapes: single-line alerts with ${var} in the text', () => {
    const doc =
      '> [!IMPORTANT] Contact [${email}](mailto:${email}) for ${name}.\n\nNext.';
    expect(convert(doc)).toBe(
      ':::important\nContact [${email}](mailto:${email}) for ${name}.\n:::\n\nNext.'
    );
  });
});

describe('line endings', () => {
  test('CRLF documents convert like LF documents and keep CRLF', () => {
    const lf =
      '> [!NOTE]\n> Hi\n\n:::callout{title="T"}\nx\n:::\n\n```ts {1}\na\n```';
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(convert(crlf)).toBe(convert(lf).replace(/\n/g, '\r\n'));
    expect(convert(crlf)).toContain(':::note\r\nHi\r\n:::');
  });
});
