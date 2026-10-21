# Paragraphs and headings

Everything on this page is standard CommonMark. MDRS parses it with [`marked`](https://marked.js.org) and only adds heading IDs and the table of contents.

## Paragraphs

Consecutive lines form one paragraph; a blank line starts the next. A single newline inside a paragraph is a soft break and renders as a space.

```mdrs
This is the first paragraph.
It continues on this line.

This is a second paragraph.
```

```html
<p>This is the first paragraph. It continues on this line.</p>
<p>This is a second paragraph.</p>
```

## Hard line breaks

End a line with a backslash, or with two or more spaces, to force a `<br>`.

```mdrs
Line one\
Line two
Line three
```

```html
<p>Line one<br />Line two Line three</p>
```

Two trailing spaces do the same, but they're invisible and many editors trim them, so prefer the backslash.

## Headings

ATX headings use one to six `#` followed by a space. Setext headings underline the text with `=` (level 1) or `-` (level 2).

```mdrs
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

Also heading 1
==============

Also heading 2
--------------
```

A post page already shows the post title as its `<h1>`, so start article sections at `##`.

### Heading IDs

After rendering, `injectHeadingIds` gives every heading an `id` built from its text and prefixed with `mdrs-`:

1. Math is replaced by its TeX source, then HTML tags are stripped.
2. The text is lowercased, everything except `a-z`, `0-9`, spaces and `-` is removed, spaces become `-`, and repeated `-` collapse.
3. The result is prefixed with `mdrs-`, so a heading can never take an ID the surrounding page already uses (a heading `## Main` becomes `mdrs-main`, not a second `main`).
4. A duplicate ID gets `-1`, `-2`, … appended.
5. A heading whose text leaves nothing behind, such as `## !!!`, gets `mdrs-heading-0`, `mdrs-heading-1`, …

```mdrs
## Install `bun`
## Install `bun`
### Math $$x^2$$
## !!!
```

```html
<h2 id="mdrs-install-bun">Install <code>bun</code></h2>
<h2 id="mdrs-install-bun-1">Install <code>bun</code></h2>
<h3 id="mdrs-math-x2">Math <span class="katex">…</span></h3>
<h2 id="mdrs-heading-0">!!!</h2>
```

Links still use the short form. A same-document link `[install](#install-bun)` is rewritten to `#mdrs-install-bun` when that heading exists, and a URL ending in `#install-bun` scrolls to the heading too ([Styling](../003-reference/003-styling.md#heading-ids-and-links)).

### Anchor links and the table of contents

In the browser, `enhanceHeadingAnchors` adds `mdrs-heading` to each heading, wraps its text in `mdrs-heading-text` and appends a pilcrow (¶) "Permanent link" anchor (`mdrs-anchor`) pointing at the heading's `#mdrs-…` ID. Headings inside charts and Mermaid diagrams are skipped.

`extractHeadings` builds the table of contents from levels 2 to 6. It skips headings that are visually hidden (`mdrs-sr-only`, `hidden`, `aria-hidden="true"`), such as the screen-reader-only "Footnotes" heading, and keeps `code`, `kbd`, `em`, `strong`, `sub` and `sup` formatting in the entry text. Math in a heading appears in the table of contents as its TeX source.

## Thematic breaks

Three or more `-`, `*` or `_` on a line of their own draw a horizontal rule.

```mdrs
Above

---

***

___

Below
```

Leave a blank line before `---`, otherwise the line above becomes a setext heading.

Source: `packages/mdrs/core/src/render/headings.ts` (`injectHeadingIds`, `prefixHashLinks`, `extractHeadings`), `packages/mdrs/core/src/markdown.ts` (`prepareMarkdownPage`), `packages/mdrs/dom/src/headingAnchors.ts`.
