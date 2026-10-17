# References

Plain [footnotes](../001-markdown/007-footnotes.md) end up in a section with a screen-reader-only heading at the bottom of the article. Wrap the definitions in `:::references` to place a visible bibliography exactly where the block stands, with a "References" heading that also appears in the table of contents.

```mdrs
A statement with a source[^source] and another one[^spec].

## Further reading

Text before the bibliography.

:::references
[^source]: Source description with a [link](https://example.com).
[^spec]: The [CommonMark spec](https://spec.commonmark.org).

:::
```

```html
<p>
    A statement with a source<sup
        ><a
            …
            href="#footnote-source"
            >[1]</a
        ></sup
    >
    …
</p>
<h2 id="further-reading">Further reading</h2>
<p>Text before the bibliography.</p>
<section
    class="mdrs-footnotes mdrs-references"
    data-mdrs-footnotes="">
    <h2 id="mdrs-fn-label">References</h2>
    <ol>
        …
    </ol>
</section>
```

## Rules

- Use at most one `:::references` block per document.
- The opening line is exactly `:::references`, without attributes, indented by up to three spaces.
- Put a blank line before the closing `:::`. Without it, Markdown formatters treat `:::` as a continuation of the last footnote.
- Footnote numbering and back-links work across the whole document, wherever the markers are.
- Without any footnote definitions, the block still renders an empty "References" heading.

## Errors

These two mistakes make the render fail; the editor preview shows the message instead of the preview:

| Mistake                    | Message                                       |
| -------------------------- | --------------------------------------------- |
| Two `:::references` blocks | `Use only one references block per document.` |
| The block is never closed  | `Close the references block with :::.`        |

Source: `packages/lib/src/markdownReferences.ts` (`extractReferences`, `placeReferences`), `packages/lib/src/components/MarkdownEditor.svelte`.
