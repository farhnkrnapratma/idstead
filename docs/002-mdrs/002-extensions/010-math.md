# Math

Math is written in TeX and rendered to HTML and MathML by [KaTeX](https://katex.org) on the server, so formulas appear without client JavaScript.

## Inline math

Wrap a formula in double dollar signs on a single line:

```mdrs
Euler's identity $$ e^{i\pi} + 1 = 0 $$ and the quadratic formula
$$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$ render inline.
```

- Write the formula either tight against both delimiters (`$$x^2$$`) or with spaces on both sides (`$$ x^2 $$`). A mix like `$$5 and $$` is not math.
- The closing `$$` can't be followed directly by a digit, and a formula can't contain `$$`. Together these rules keep prices such as `$$5 and $$10` as plain text, the way Pandoc treats `$`.
- An inline formula can't span lines. `$$ a` on one line and `b $$` on the next stay plain text.
- A single `$` is always plain text, so prices like $5 and $10 are safe.
- Write `\$$` to get a literal `$$`.

## Display math

Use a `:::math` block for an equation on its own line, centred and horizontally scrollable when wide:

```mdrs
:::math
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
:::
```

```html
<div class="mdrs-math mdrs-math--block">
    <span class="katex-display"><span class="katex">…</span></span>
</div>
```

`:::math` blocks also work inside list items (indented up to three spaces) and blockquotes:

```mdrs
1. The Basel problem:
   :::math
   \sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
   :::

> :::math
> E = mc^2
> :::
```

The block ends at the first `:::` line, so a `:::math` block can't contain other directives.

## Variables in math

`${…}` interpolation works inside formulas, so a [variable](013-variables.md) can feed a formula:

```mdrs
:::define
n: 12
:::

$$ \sum_{k=1}^{${n}} k = ${n * (n + 1) / 2} $$
```

This renders the formula `\sum_{k=1}^{12} k = 78`.

## Errors

KaTeX runs with `throwOnError: false`. Invalid TeX renders KaTeX's own red error span, holding the source and a `title` that explains the problem:

```mdrs
$$ \frac{1 $$
```

```html
<span
    class="katex-error"
    title="ParseError: KaTeX parse error: …"
    style="color:#cc0000"
    >\frac{1</span
>
```

## Math in headings and the table of contents

A heading may contain inline math. Its ID and its table-of-contents entry use the TeX source (`### Math $$x^2$$` gets the ID `math-x2`).

## Code is never math

`$$` inside code spans and fenced code blocks is left alone.

Source: `packages/lib/src/markdown.ts` (`MATH_BLOCK_RE`, `MATH_INLINE_RE`, `extractMath`, `renderMathSource`).
