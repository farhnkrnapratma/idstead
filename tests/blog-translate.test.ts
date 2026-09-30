import {test} from 'bun:test';
import {translatePost} from '../src/lib/server/blogTranslate';
import {
  TRANSLATION_LOCALES,
  type TranslationLocale
} from '../src/lib/translationLocales';

type Runner = {run: (model: string, input: unknown) => Promise<unknown>};

function fakeAi(
  transform: (content: string, system: string) => string
): Runner {
  return {
    run: async (_model: string, input: unknown) => {
      const messages = (input as {messages: {content: string}[]}).messages;
      return {response: transform(messages[1].content, messages[0].content)};
    }
  };
}

const isLabelPass = (system: string) =>
  system.includes('user interface labels');

const markdown = `# Judul

Teks biasa dengan \`inline code\` dan istilah SvelteKit.

\`\`\`ts
const a = 1
\`\`\`

$$ \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi} $$

> [!NOTE]
> Sebuah catatan.

:::callout{title="Change Log" icon="list"}
Isi callout yang boleh diterjemahkan.
:::

:::locale{only="en"}
Paragraf khusus bahasa Inggris.
:::

:::steps
Langkah pertama.
:::

:::embed{url="https://youtu.be/Ec08db2hP10?si=eLTsf5ioVK5OwQOi"}

Rumus $E = mc^2$ dan tombol <kbd>Ctrl</kbd>.

${'Paragraf panjang. '.repeat(200).trim()}

Penutup.`;

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function checkLocale(locale: TranslationLocale) {
  const echoed = await translatePost(
    locale,
    {title: 'Judul', excerpt: null, summary: null, tldr: null, markdown},
    fakeAi(content => content),
    ['SvelteKit']
  );
  assert(echoed !== null, 'translatePost returned null');
  assert(
    echoed!.markdownChunks > 1,
    `expected multiple chunks, got ${echoed!.markdownChunks}`
  );
  assert(
    echoed!.markdownFallbackChunks === 0,
    'echo runner should never fall back'
  );
  assert(
    echoed!.markdown === markdown,
    'round-trip did not restore the original Markdown'
  );

  const saboteur = await translatePost(
    locale,
    {title: 'Judul', excerpt: null, summary: null, tldr: null, markdown},
    fakeAi((content, system) =>
      isLabelPass(system) ? content : (
        content
          .replace(/locale/g, 'lokasi')
          .replace(/steps/g, 'langkah-langkah')
          .replace(/only=/g, 'hanya=')
          .replace(/url=/g, 'alamat=')
      )
    ),
    []
  );
  const sabotaged = saboteur?.markdown ?? '';
  for (const marker of [
    ':::locale{only="en"}',
    ':::steps',
    ':::callout{title="Change Log" icon="list"}',
    ':::embed{url="https://youtu.be/Ec08db2hP10?si=eLTsf5ioVK5OwQOi"}'
  ]) {
    assert(
      sabotaged.includes(marker),
      `directive marker was translated away: ${marker}`
    );
  }
  assert(
    sabotaged.includes('$$ \\int_{-\\infty}'),
    'block math delimiters were not restored verbatim'
  );

  const labelled = await translatePost(
    locale,
    {title: 'Judul', excerpt: null, summary: null, tldr: null, markdown},
    fakeAi((content, system) =>
      isLabelPass(system) ?
        content
          .split('\n')
          .map(line => `ID ${line}`)
          .join('\n')
      : content
    ),
    []
  );
  assert(
    labelled?.markdown?.includes('title="ID Change Log"') === true,
    'callout title was not translated by the marker-label pass'
  );

  const glued = await translatePost(
    locale,
    {title: 'Judul', excerpt: null, summary: null, tldr: null, markdown},
    fakeAi((content, system) =>
      isLabelPass(system) ? content : (
        content.replace(/\n(@@DIRECTIVE_CLOSE_\d+@@)/g, ' $1')
      )
    ),
    []
  );
  assert(
    (glued?.markdownFallbackChunks ?? 0) > 0,
    'moving a closing directive marker mid-line must be rejected'
  );
  assert(
    /^:::$/m.test(glued?.markdown ?? ''),
    'closing directive marker must stay on its own line'
  );

  const eaten = await translatePost(
    locale,
    {title: 'Judul', excerpt: null, summary: null, tldr: null, markdown},
    fakeAi((content, system) =>
      isLabelPass(system) ? content : (
        content.replace(/@@[A-Z_]+_\d+@@/g, 'dihapus')
      )
    ),
    []
  );
  assert(
    (eaten?.markdownFallbackChunks ?? 0) > 0,
    'chunks losing placeholders must be rejected by the quality gate'
  );
  assert(
    !/@@[A-Z_]+_\d+@@/.test(eaten?.markdown ?? ''),
    'unrestored placeholder leaked into the output'
  );
}

for (const locale of TRANSLATION_LOCALES) {
  test(`translation preserves Markdown, directives and math for ${locale}`, () =>
    checkLocale(locale));
}

test('summary and tldr translation completeness flags reflect real success/failure', async () => {
  const success = await translatePost(
    'id',
    {
      title: 'Judul',
      excerpt: null,
      summary: 'Ringkasan.',
      tldr: ['Satu', 'Dua'],
      markdown: '# Judul\n\nIsi.'
    },
    fakeAi(content => content),
    []
  );
  assert(
    success?.summaryTranslated === true,
    'summary should be marked translated on success'
  );
  assert(
    success?.tldrTranslated === true,
    'tldr should be marked translated on success'
  );

  const failure = await translatePost(
    'id',
    {
      title: 'Judul',
      excerpt: null,
      summary: 'Ringkasan.',
      tldr: ['Satu', 'Dua'],
      markdown: '# Judul\n\nIsi.'
    },
    fakeAi(() => 'UNTRANSLATABLE'),
    []
  );
  assert(
    failure?.summaryTranslated === false,
    'summary should be marked untranslated when the model refuses'
  );
  assert(
    failure?.tldrTranslated === false,
    'tldr should be marked untranslated when the model refuses'
  );

  const nothingToTranslate = await translatePost(
    'id',
    {
      title: 'Judul',
      excerpt: null,
      summary: null,
      tldr: null,
      markdown: '# Judul\n\nIsi.'
    },
    fakeAi(content => content),
    []
  );
  assert(
    nothingToTranslate?.summaryTranslated === true,
    'no summary to translate should not count as a failure'
  );
  assert(
    nothingToTranslate?.tldrTranslated === true,
    'no tldr to translate should not count as a failure'
  );
});

test('markdown chunk quality gate tolerates a small heading-count drift but rejects a large one', async () => {
  const source = '# Heading One\n\nSome text.\n\n## Heading Two\n\nMore text.';
  const addExtraHeadings =
    (count: number) => (content: string, system: string) =>
      isLabelPass(system) ? content : (
        `${'# Extra\n\n'.repeat(count)}${content}`
      );

  const withinTolerance = await translatePost(
    'id',
    {
      title: 'Judul',
      excerpt: null,
      summary: null,
      tldr: null,
      markdown: source
    },
    fakeAi(addExtraHeadings(1)),
    []
  );
  assert(
    (withinTolerance?.markdownFallbackChunks ?? 1) === 0,
    'one extra heading per chunk should be tolerated'
  );

  const beyondTolerance = await translatePost(
    'id',
    {
      title: 'Judul',
      excerpt: null,
      summary: null,
      tldr: null,
      markdown: source
    },
    fakeAi(addExtraHeadings(2)),
    []
  );
  assert(
    (beyondTolerance?.markdownFallbackChunks ?? 0) > 0,
    'two extra headings per chunk should still be rejected'
  );
});
