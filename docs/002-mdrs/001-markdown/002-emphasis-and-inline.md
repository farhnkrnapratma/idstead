# Emphasis and inline text

Standard CommonMark and GFM inline formatting.

## Bold, italic and strikethrough

```mdrs
**bold** or __bold__
*italic* or _italic_
***bold italic*** or _**bold italic**_
~~strikethrough~~
```

```html
<strong>bold</strong> <em>italic</em> <em><strong>bold italic</strong></em> <del>strikethrough</del>
```

Underscores inside words don't trigger emphasis (`snake_case_name` stays as it is), asterisks do.

## Backslash escapes

A backslash before any ASCII punctuation character makes it literal.

```mdrs
\*not italic\* \# not a heading \[not a link\](url) 1\. not a list
```

```html
<p>*not italic* # not a heading [not a link](url) 1. not a list</p>
```

To write MDRS-specific syntax literally (directives, `$$`, `${…}`), see [Escaping](../002-extensions/015-escaping.md): a backslash doesn't help for every one of them.

## Entities

HTML entities and numeric character references are passed through: `&copy;`, `&mdash;`, `&#8212;`, `&#x2014;`.

```mdrs
&copy; 2026 · 5 &times; 3 &rarr; 15
```

## Inline HTML

A few inline HTML elements have no Markdown equivalent and are allowed by the sanitizer:

```mdrs
Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>.
H<sub>2</sub>O and 10<sup>6</sup>.
<u>Underlined</u>, <mark>highlighted</mark>, <ins>inserted</ins>, <del>deleted</del>, <s>struck</s>.
<abbr title="Markdown Rich Syntax">MDRS</abbr><br>next line
```

Other tags are removed while their text is kept. The full list is on [Raw HTML](008-raw-html.md).

## Comments

HTML comments are removed from the output, so they work for notes to yourself.

```mdrs
<!-- TODO: add a benchmark -->
Visible text.
```

```html
<p>Visible text.</p>
```

Source: `marked` (GFM mode), `packages/mdrs/src/sanitize.ts`.
