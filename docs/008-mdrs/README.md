# MDRS

**MDRS (Markdown Rich Syntax)** is the Markdown dialect every post and legal page on my-site.example is written in. It is plain Markdown (CommonMark plus GitHub Flavored Markdown) with extra syntax on top: directives (`:::note`, `:::tabs`, …), math, diagrams, charts, references and document variables.

|  |  |
| --- | --- |
| Language | MDRS, short for Markdown Rich Syntax ("md + rs", in the way MDX is "md + jsx") |
| File extension | `.mdrs` |
| Implementation today | The `@mdrs/core` workspace package (`packages/mdrs/core`: `markdown.ts` runs the pipeline, `render/` holds one module per syntax, `define/` the variable language) plus its browser side, `@mdrs/dom` (`packages/mdrs/dom`: enhancers, chart component and `mdrs.css`) |
| Future packages | npm [`@mdrs/core`](https://www.npmjs.com/package/@mdrs/core) and crate [`mdrs`](https://crates.io/crates/mdrs), both reserved at `0.0.0`; see [roadmap](003-reference/004-roadmap.md) |

## Design goal: a drop-in superset

A document written in plain Markdown renders with MDRS exactly as it does with any CommonMark/GFM renderer. The extra syntax only kicks in where plain Markdown has no meaning of its own, or where a document opts in: `${…}` interpolation, for example, needs a `:::define` block. [Compatibility](003-reference/001-compatibility.md) lists how plain Markdown is kept as written, and the few deliberate extensions.

Every class and ID MDRS generates starts with `mdrs`, and the default look lives in one stylesheet, so each site can restyle the output ([Styling](003-reference/003-styling.md)).

## Reading the examples

Examples are fenced as `mdrs`. Examples that deliberately show an error are fenced as `mdrs error`. Rendered output is shown as trimmed HTML. For a complete post that uses every feature, see [SHOWCASE.md](SHOWCASE.md).

## A taste

```mdrs
:::define
project: "MDRS"
stable: false
:::

# Hello from ${project}

Plain **Markdown** works as usual, with [links](https://commonmark.org) and `code`.

:::tip
Directives open with `:::name` and close with a bare `:::`.
:::

${if !stable}This build is a preview.${endif}

Inline math: $$ e^{i\pi} + 1 = 0 $$
```

This renders a heading "Hello from MDRS", a normal paragraph, a green "Tip" callout, the sentence "This build is a preview." (because `stable` is `false`) and Euler's identity typeset by KaTeX.

## Pages

The docs start with the Markdown you already know, then cover what MDRS adds.

### Part 1: standard Markdown

| Page | Covers |
| --- | --- |
| [Paragraphs and headings](001-markdown/001-paragraphs-and-headings.md) | Paragraphs, line breaks, headings, heading IDs, table of contents, thematic breaks |
| [Emphasis and inline text](001-markdown/002-emphasis-and-inline.md) | Bold, italic, strikethrough, escapes, entities, inline HTML |
| [Links and images](001-markdown/003-links-and-images.md) | Inline, reference and autolinks, URL safety, external links, images |
| [Lists](001-markdown/004-lists.md) | Bulleted, numbered and nested lists, GFM task lists |
| [Blockquotes and tables](001-markdown/005-blockquotes-and-tables.md) | Quotes, GFM tables and alignment |
| [Code](001-markdown/006-code.md) | Code spans, fenced and indented code blocks, syntax highlighting |
| [Footnotes](001-markdown/007-footnotes.md) | GFM footnotes and back-links |
| [Raw HTML](001-markdown/008-raw-html.md) | Which HTML survives the sanitizer |

### Part 2: MDRS extensions

| Page | Covers |
| --- | --- |
| [Frontmatter](002-extensions/001-frontmatter.md) | YAML metadata at the top of a document |
| [Directives](002-extensions/002-directives.md) | The `:::` grammar every block extension shares |
| [Callouts](002-extensions/003-callouts.md) | `:::note`, `:::tip`, `:::important`, `:::warning`, `:::caution`, GitHub `> [!NOTE]` alerts, `:::callout`, icons |
| [Details](002-extensions/004-details.md) | Collapsible `:::details` sections |
| [Tabs and snippets](002-extensions/005-tabs-and-snippets.md) | `:::tabs`, `:::snippets` and `::tab` |
| [Steps](002-extensions/006-steps.md) | Numbered timelines with `:::steps` |
| [Code blocks](002-extensions/007-code-blocks.md) | `filename=`, `mark=`, diffs, command blocks, reader controls |
| [Task states](002-extensions/008-task-states.md) | Seven checkbox states instead of two |
| [Media and embeds](002-extensions/009-media-and-embeds.md) | Video, AVIF images, YouTube and CodePen embeds |
| [Math](002-extensions/010-math.md) | Inline `$$ … $$` and `:::math` blocks |
| [Diagrams and charts](002-extensions/011-diagrams-and-charts.md) | Mermaid and chart fences |
| [References](002-extensions/012-references.md) | A bibliography block for footnotes |
| [Variables](002-extensions/013-variables.md) | `:::define`, strings, expressions, the ternary and `${…}` |
| [Live data](002-extensions/014-live-data.md) | `api.v1.author`, `api.v1.blog` and `api.v1.analytics` in expressions |
| [Conditionals](002-extensions/016-conditionals.md) | `:::if` blocks and inline `${if}` |
| [Escaping](002-extensions/015-escaping.md) | Writing MDRS syntax literally, `\${`, `:::verbatim` |

### Part 3: reference

| Page | Covers |
| --- | --- |
| [Compatibility](003-reference/001-compatibility.md) | How MDRS stays a drop-in superset of CommonMark/GFM |
| [Rendering pipeline](003-reference/002-rendering-pipeline.md) | Stage order, public functions, limits, where MDRS is used |
| [Styling](003-reference/003-styling.md) | The `mdrs-*` class and ID contract, the default stylesheet, theming |
| [Roadmap](003-reference/004-roadmap.md) | The name, the reserved packages, the TypeScript + Rust split, tooling |

## Cheat sheet

````mdrs
---
title: Optional YAML frontmatter, first line only
tags: [mdrs]
---

:::note
Also :::tip, :::important, :::warning and :::caution.
:::

> [!TIP]
> GitHub alerts work too.

:::callout title="Changelog" icon="rocket"
Custom callout. `title` is required, `icon` is optional.
:::

:::details summary="Click to expand"
Collapsible content.
:::

:::tabs
::tab label="One" icon="zap"
Any Markdown.
::
::tab label="Two"
More Markdown.
::
:::

:::snippets key="pm"
::tab label="bun" icon="terminal"
```sh
bun add katex
```
::
:::

:::steps
1. First
2. Second
:::

:::embed url="https://youtu.be/VIDEO_ID"

- [*] In progress, also [/] [-] [!] [?]

Inline $$ a^2 + b^2 = c^2 $$ and a block:

:::math
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
:::

A claim[^source].

:::references
[^source]: Source description.

:::

```python filename="main.py" mark=1,3..4
print("one")
print("two")
print("three")
print("four")
```
````

Source: `packages/mdrs/core/src/markdown.ts`, `packages/mdrs/core/src/define/`.
