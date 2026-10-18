# Code

## Code spans

Wrap inline code in backticks. To include a backtick, use a longer run of backticks around it.

```mdrs
Run `bun install`, then ``echo `date` `` prints the date.
```

```html
<p>Run <code>bun install</code>, then <code>echo `date`</code> prints the date.</p>
```

Code spans also protect MDRS syntax: `` `$$x$$` ``, `` `${name}` `` and `` `:::note` `` stay literal inside them.

## Fenced code blocks

Fence a block with three or more backticks or tildes. The word after the opening fence is the language.

````mdrs
```ts
const answer: number = 42;
```

~~~python
print("Hello, World!")
~~~
````

```html
<pre><code class="language-ts">const answer: number = 42;
</code></pre>
```

To show a fence inside a code block, make the outer fence longer than the inner one, as this page does.

Syntax highlighting runs in the browser with [highlight.js](https://highlightjs.org): any language highlight.js knows works, and unknown languages are shown as plain text. The header bar shows the language's display name (`ts` becomes "TypeScript"), or "Code" when there's no language.

## Indented code blocks

Lines indented by four spaces also form a code block, without a language:

```mdrs
Paragraph.

    indented code
```

Prefer fences. They can carry a language, a file name and line markers, and they're easier to see in the source.

## What MDRS adds

The info string after the language can carry `filename="…"` and `mark=…` options, and some languages get special treatment (`diff`, shell, `mermaid`, `chart`). Every block also gets copy, download, wrap and line-number controls in the browser. See [Code blocks](../002-extensions/007-code-blocks.md) and [Diagrams and charts](../002-extensions/011-diagrams-and-charts.md).

Source: `marked`, `packages/mdrs/src/markdown.ts` (`code` renderer), `packages/lib/src/utils/codeBlocks.ts`.
