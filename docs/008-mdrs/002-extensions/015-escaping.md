# Escaping

Sometimes you need to show MDRS syntax instead of having it rendered, for example in a post about MDRS itself. This page lists what works for each construct.

| To show literally | Use |
| --- | --- |
| Any Markdown punctuation (`*`, `_`, `#`, `[`, …) | A backslash: `\*` |
| `$$` | `\$$` |
| `${name}` or `${if x}` | Nothing in a document without `:::define`; otherwise a backslash (`\${name}`, `\${if x}`), a code span or code block, or `:::verbatim` |
| A directive (`:::note`, `:::if`) | A code span or code block, or `:::verbatim` |
| A whole example, including fences and directives | A longer outer fence, or a longer `::::verbatim` fence |

## Code spans and code blocks

Code is never interpreted: directives, math, interpolation and conditionals stay literal inside code spans and fenced code blocks.

````mdrs
Write `${name}` to insert a variable and `$$x^2$$` for math.

```mdrs
:::note
This callout is shown as source.
:::
```
````

To show a fenced block that itself contains a fence, make the outer fence longer (four backticks around three).

## `:::verbatim`

`:::verbatim` outputs its body as escaped, preformatted text. It is protected before conditionals, variables, math and directives run, so nothing inside it is interpreted. Unlike a code block it has no language, header bar or copy button.

```mdrs
:::verbatim
${not_a_variable} $$not math$$ <b>not bold</b>
:::
```

```html
<pre>${not_a_variable} $$not math$$ &lt;b&gt;not bold&lt;/b&gt;</pre>
```

The block ends at the first line made of the same number of colons as its opening. To show a complete directive, closing line included, open it with four (or more) colons:

```mdrs
::::verbatim
:::note
A callout shown as source.
:::
::::
```

```html
<pre>
:::note
A callout shown as source.
:::</pre>
```

## Backslash before `${`

In a document with a `:::define` block, a backslash keeps interpolation and inline conditionals literal. The backslash itself is removed, as for any escaped punctuation:

```mdrs
:::define
name: "MDRS"
:::

Write \${name} to get ${name}, and \${if flag} stays as written.
```

Renders "Write ${name} to get MDRS, and ${if flag} stays as written."

In a document without `:::define`, nothing needs escaping: `${…}` is already plain text there.

## Single dollar signs

A single `$` never starts math, so prices need no escaping: `It costs $5`. Doubled dollars followed by a digit, as in `$$5 and $$10`, aren't math either ([Math](010-math.md#inline-math)).

Source: `packages/mdrs/core/src/render/verbatim.ts` (`VERBATIM_OPEN_RE`, `extractVerbatimBlocks`, `protectVerbatimBlocks`), `packages/mdrs/core/src/render/math.ts` (`MATH_INLINE_RE`), `packages/mdrs/core/src/define/interpolation.ts` (`scanInterpolationTokens`), `packages/mdrs/core/src/define/block.ts` (`hasDefineEntries`).
