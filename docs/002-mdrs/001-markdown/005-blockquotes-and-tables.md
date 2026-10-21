# Blockquotes and tables

## Blockquotes

Prefix each line with `>`. Blockquotes can hold any other block, including lists, code and nested quotes.

```mdrs
> A greater-than sign opens a blockquote.
>
> > Nested quote.
>
> - A list inside the quote
```

```html
<blockquote>
    <p>A greater-than sign opens a blockquote.</p>
    <blockquote>
        <p>Nested quote.</p>
    </blockquote>
    <ul class="mdrs-list mdrs-list--unordered">
        …
    </ul>
</blockquote>
```

Directives work inside quotes too. Prefix their lines with `>` like any other content:

```mdrs
> :::note
> Callouts render inside the quote.
> :::
```

A quote whose first line is a GitHub alert marker (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`) renders as the matching callout, as it does on GitHub ([Callouts](../002-extensions/003-callouts.md#github-alerts)). Any other quote stays a blockquote.

## Tables

GFM tables need a header row and a delimiter row. Colons in the delimiter row set the column alignment.

```mdrs
| Feature | Engine | Output |
| :--- | :---: | ---: |
| Math | KaTeX | HTML + MathML |
| Diagrams | Mermaid | SVG |
| Charts | LayerChart | SVG |
```

```html
<div class="mdrs-table">
    <table>
        <thead>
            <tr>
                <th align="left">Feature</th>
                <th align="center">Engine</th>
                <th align="right">Output</th>
            </tr>
        </thead>
        <tbody>
            …
        </tbody>
    </table>
</div>
```

- `:---` aligns left, `:---:` centres and `---:` aligns right; plain `---` uses the default.
- Cells hold inline Markdown only: emphasis, code, links, math. Write a literal `|` inside a cell as `\|`.
- The outer pipes are optional, and the columns don't have to line up in the source.
- Every table is wrapped in a horizontally scrollable `div.mdrs-table`, so wide tables don't break the layout on phones.

Source: `packages/mdrs/core/src/render/parser.ts` (`table` renderer), `packages/mdrs/core/src/render/alerts.ts` (`convertGithubAlerts`).
