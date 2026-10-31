# Compatibility

MDRS is a **drop-in superset** of Markdown: a document written for any CommonMark/GFM renderer means the same thing in MDRS, and MDRS syntax only takes effect where plain Markdown has no meaning of its own, or where a document opts in.

This page records how the engine meets that goal. Every row below has a regression test in `tests/markdown.test.ts` or `tests/frontmatter.test.ts`. They were last checked on 2026-10-17.

## What is fully standard

Block and inline parsing is delegated to [`marked`](https://marked.js.org) in GFM mode, so these behave like any CommonMark/GFM renderer:

- paragraphs, soft and hard breaks, ATX and setext headings, thematic breaks;
- emphasis, strong, strikethrough, code spans, backslash escapes, entities;
- inline, reference and autolinks (including GFM `www.` and e-mail autolinks), images;
- blockquotes, bulleted and numbered lists (tight and loose), `[ ]`/`[x]` task items in both;
- fenced and indented code blocks, GFM tables with alignment, GFM footnotes;
- `${…}` and `${if …}` in a document without a `:::define` block, which stay literal text;
- `:::` lines that don't form a known, closed directive, which stay plain text.

## Output differences that don't change meaning

MDRS emits richer HTML than a reference renderer: `mdrs-*` classes and wrappers on lists and tables, an external-link icon with `target="_blank"`, lazy-loaded images, and heading IDs with an `mdrs-` prefix ([Styling](003-styling.md)). Raw HTML goes through an allowlist sanitizer ([Raw HTML](../001-markdown/008-raw-html.md)), as it does on GitHub. None of this changes what the document says.

## Plain Markdown that MDRS keeps as written

Plain Markdown inputs that other engines or MDRS syntax could misread, and what MDRS renders for them.

| Plain Markdown input | Output |
| --- | --- |
| `Template: ${name} here` | Literal text. Interpolation needs a non-empty `:::define` block ([Variables](../002-extensions/013-variables.md)) |
| `Costs $$5 and $$10` | Literal text. The closing `$$` can't be followed by a digit, and the delimiters must hug the formula on both sides or be spaced on both ([Math](../002-extensions/010-math.md#inline-math)) |
| `1. [x] done` | A numbered task item with its state icon |
| `<dl>`, `<q>`, `<small>`, `<cite>`, `<figure>`, `<figcaption>`, `<dfn>`, `<var>`, `<samp>`, `<time>` | Kept |
| A loose list (`- a`, blank line, `- b`) | `<p>` kept, as in CommonMark |
| `1. [^a]: text` | Parsed as GFM parses it, with no rewrite |
| A URL containing `@@` | Kept. Internal placeholders use private-use characters (U+E000/U+E001), which are stripped from input |
| `> [!NOTE]` and the other GitHub alerts | The matching callout, as on GitHub ([Callouts](../002-extensions/003-callouts.md#github-alerts)) |
| `## !!!` | `id="mdrs-heading-0"` |
| `## Main` on a page that already has `id="main"` | `id="mdrs-main"`; `#main` links still reach it |

## Deliberate extensions

These are the only places where MDRS reads plain text differently. Each one is either rare in real documents or matches what GitHub does.

| Input | Plain CommonMark | MDRS | Why it stays |
| --- | --- | --- | --- |
| `- [-] item`, `[*]`, `[/]`, `[!]`, `[?]` | A list item starting with that text | An extended [task state](../002-extensions/008-task-states.md) | The pattern has no meaning in GFM and rarely appears by accident |
| ` ```mermaid `, ` ```chart ` | A code block | A diagram or chart | GitHub renders `mermaid` fences too; use another info string, such as `mmd`, to show the source |
| A line that is exactly `:::if …`, `:::elif …`, `:::else` or `:::endif` | A paragraph | A [conditional](../002-extensions/016-conditionals.md) | The `:::` prefix has no meaning in plain Markdown, and unmatched lines stay plain text |
| A first line `---` followed by YAML and a closing `---` | A thematic break and a setext heading | [Frontmatter](../002-extensions/001-frontmatter.md), not rendered | Same convention as GitHub, Jekyll, Hugo and MDX. Content that isn't a YAML mapping falls back to plain Markdown |
| A document over 500,000 characters | Rendered | Throws `Markdown document is too large to render.` | A safety limit for the Worker; save validation reports it first |

## Other notes

- `:::verbatim` closes on a line with the same number of colons, so `::::verbatim` can show a complete directive ([Escaping](../002-extensions/015-escaping.md)).
- A `${…}` inside a conditional branch is evaluated only when that branch is chosen ([Conditionals](../002-extensions/016-conditionals.md)).
- Task-state icons are decorative; a visually hidden label announces each state.

## Checking compatibility

The plan for the standalone engine is to run the official [CommonMark spec examples](https://spec.commonmark.org) and the GFM spec examples as a test suite, normalising away the extra classes and wrappers, alongside the regression tests above.

Source: `packages/mdrs/core/src/markdown.ts`, `packages/mdrs/core/src/define/`, `packages/mdrs/core/src/frontmatter.ts`, `packages/mdrs/core/src/placeholders.ts`, `packages/mdrs/core/src/sanitize.ts`.
