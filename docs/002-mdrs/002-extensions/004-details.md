# Details

A collapsible section. `summary` is required and becomes the clickable title; the body is regular Markdown.

```mdrs
:::details summary="What does server-side rendered math mean?"
KaTeX turns the TeX source into HTML and MathML on the server, so formulas
appear without any client JavaScript.
:::
```

```html
<details class="mdrs-details">
    <summary class="mdrs-details-summary">
        <span class="mdrs-details-title">What does server-side rendered math mean?</span>
        <span
            class="mdrs-details-icon"
            aria-hidden="true"
            >…</span
        >
    </summary>
    <div class="mdrs-details-body">
        <p>KaTeX turns the TeX source into HTML and MathML on the server, …</p>
    </div>
</details>
```

Sections start collapsed. In the browser the summary gets a keyboard shortcut hint: <kbd>E</kbd> expands or collapses the focused section.

## Nesting

Details can hold any block, including other details:

````mdrs
:::details summary="Outer"
Some text.

:::details summary="Inner"
- A list
- inside the nested section

```sh
echo "code works too"
```
:::
:::
````

## Errors

Without `summary`, the block renders the error `:::details requires summary="..."`.

A hand-written `<details><summary>…</summary>…</details>` gets the same styling; see [Raw HTML](../001-markdown/008-raw-html.md#raw-details).

Source: `packages/mdrs-core/src/render/containers.ts` (`renderContainer`), `packages/mdrs-core/src/render/details.ts` (`parseDetailsBlocks`), `packages/mdrs-dom/src/enhance.ts` (`enhanceMarkdownDetails`).
