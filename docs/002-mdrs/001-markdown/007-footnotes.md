# Footnotes

GFM footnotes, rendered by [`marked-footnote`](https://github.com/bent10/marked-extensions/tree/main/packages/footnote).

## Syntax

Place a marker `[^label]` in the text and define it anywhere in the document with `[^label]: text`. Labels can be numbers or words; the rendered numbers follow the order in which footnotes are first referenced.

```mdrs
MDRS renders math on the server[^katex] and diagrams in the browser[^mermaid].

[^katex]: With [KaTeX](https://katex.org), so no client JavaScript is needed.
[^mermaid]: Mermaid loads lazily when the diagram is rendered.
```

```html
<p>
    MDRS renders math on the server<sup
        ><a
            id="mdrs-fn-ref-katex"
            href="#mdrs-fn-katex"
            data-mdrs-fn-ref=""
            aria-describedby="mdrs-fn-label"
            >[1]</a
        ></sup
    >
    …
</p>
<section
    class="mdrs-footnotes"
    data-mdrs-footnotes="">
    <h2
        id="mdrs-fn-label"
        class="mdrs-sr-only">
        Footnotes
    </h2>
    <ol>
        <li id="mdrs-fn-katex">
            <p>
                <a
                    href="#mdrs-fn-ref-katex"
                    class="mdrs-footnote-backref"
                    aria-label="Back to reference"
                    >^</a
                >With <a …>KaTeX</a>, so no client JavaScript is needed.
            </p>
        </li>
        …
    </ol>
</section>
```

Definitions are collected into a `section.mdrs-footnotes` at the end of the document. Its "Footnotes" heading is for screen readers only and stays out of the table of contents.

## Back-links

MDRS moves the back-link to the start of each definition:

- A footnote cited once gets a single `^` link back to the citation.
- A footnote cited several times gets a static `^` followed by one link per citation, lettered `a`, `b`, `c`, … (after `z` comes `aa`).

```mdrs
Cited once[^1], then twice[^2] and again[^2].

[^1]: Single back-link.
[^2]: Two back-links, a and b.
```

## Multi-line definitions

Indent continuation lines to keep them in the same footnote:

```mdrs
A long note[^long].

[^long]: First paragraph of the note.

    Second paragraph, indented four spaces.
```

## A visible references section

To get a visible "References" heading in the article and its table of contents, wrap the definitions in a `:::references` block. See [References](../002-extensions/012-references.md).

IDs and data attributes use the `mdrs-fn-` prefix, so they can't collide with IDs on the surrounding page.

Source: `packages/mdrs/core/src/render/parser.ts` (`markedFootnote({ refMarkers: true, prefixId: 'mdrs-fn-', … })`), `packages/mdrs/core/src/render/footnotes.ts` (`formatFootnoteReferences`).
