# Escaping

Sometimes you need to show MDRS syntax instead of having it rendered, for example in a post about MDRS itself. This page lists what works for each construct.

| To show literally | Use |
| --- | --- |
| Any Markdown punctuation (`*`, `_`, `#`, `[`, …) | A backslash: `\*` |
| `$$` | `\$$` |
| `${name}` or `[text].${x}` | Nothing in a document without `:::define`; otherwise a backslash (`\${name}`, `[text].\${x}`), a code span or code block, or `:::ignore-render` |
| A directive (`:::note`) | A code span or code block, or `:::ignore-render` |
| A whole example, including fences and directives | A longer outer fence, or a longer `::::ignore-render` fence |

## Code spans and code blocks

Code is never interpreted: directives, math, interpolation and conditional text stay literal inside code spans and fenced code blocks.

````mdrs
Write `${name}` to insert a variable and `$$x^2$$` for math.

```mdrs
:::note
This callout is shown as source.
:::
```
````

To show a fenced block that itself contains a fence, make the outer fence longer (four backticks around three).

## `:::ignore-render`

`:::ignore-render` outputs its body as escaped, preformatted text, after variables, math and directives have been protected. Unlike a code block it has no language, header bar or copy button.

```mdrs
:::ignore-render
${not_a_variable} $$not math$$ <b>not bold</b>
:::
```

```html
<pre>${not_a_variable} $$not math$$ &lt;b&gt;not bold&lt;/b&gt;</pre>
```

The block ends at the first line made of the same number of colons as its opening. To show a complete directive, closing line included, open it with four (or more) colons:

```mdrs
::::ignore-render
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

In a document with a `:::define` block, a backslash keeps interpolation and conditional text literal. The backslash itself is removed, as for any escaped punctuation:

```mdrs
:::define
name: "MDRS"
:::

Write \${name} to get ${name}, and [shown].\${flag} stays as written.
```

Renders "Write ${name} to get MDRS, and [shown].${flag} stays as written."

In a document without `:::define`, nothing needs escaping: `${…}` is already plain text there.

## Single dollar signs

A single `$` never starts math, so prices need no escaping: `It costs $5`. Doubled dollars followed by a digit, as in `$$5 and $$10`, aren't math either ([Math](010-math.md#inline-math)).

Source: `packages/mdrs/core/src/render/ignoreRender.ts` (`IGNORE_RENDER_OPEN_RE`, `extractIgnoreRenderBlocks`), `packages/mdrs/core/src/render/math.ts` (`MATH_INLINE_RE`), `packages/mdrs/core/src/define/interpolation.ts` (`scanInterpolationTokens`), `packages/mdrs/core/src/define/block.ts` (`hasDefineEntries`).
