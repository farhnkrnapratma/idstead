# Raw HTML

CommonMark lets you write raw HTML anywhere. MDRS runs all of its output through an allowlist sanitizer (`sanitizeHtml`), whether the HTML came from the author or from the engine itself. Raw HTML therefore works, but only a safe subset survives.

## What happens to a tag

| Tag kind | Result |
| --- | --- |
| Allowed tag | Kept, with only its allowed attributes |
| Unknown tag (`<input>`, `<font>`, `<center>`, …) | Tag removed, text content kept |
| `script`, `style`, `textarea`, `title`, `noscript`, `template`, `noembed`, `noframes`, `xmp`, `plaintext`, `object`, `embed`, `applet` | Removed together with their content |
| HTML comments, `<!…>`, `<?…>` | Removed |
| A stray `<` that doesn't start a tag | Escaped to `&lt;` |
| Unclosed tags | Closed at the end of the document |

```mdrs
<dl><dt>Term</dt><dd>Definition</dd></dl>
<script>alert(1)</script>
<center>Old</center> <kbd>Ctrl</kbd>
```

```html
<dl>
    <dt>Term</dt>
    <dd>Definition</dd>
</dl>
Old <kbd>Ctrl</kbd>
```

## Allowed tags

| Group | Tags |
| --- | --- |
| Text | `a abbr b br cite code del dfn em i ins kbd mark q s samp small span strong sub sup time u var` |
| Blocks | `blockquote details div dl dt dd figure figcaption h1`–`h6` `hr li ol p pre section summary ul` |
| Tables | `table thead tbody tfoot tr th td` |
| Media | `img picture source video iframe` |
| Other | `button` |
| SVG | `svg path circle rect line ellipse polyline polygon` |
| MathML | `math semantics annotation mrow mi mn mo mtext mspace msub msup msubsup mfrac msqrt mroot mover munder munderover mtable mtr mtd mstyle mpadded mphantom menclose mmultiscripts mprescripts none` |

## Allowed attributes

- On every tag: `class`, `id`, `role`, `title`, `hidden`, `aria-hidden`, `aria-label`, `aria-selected`, `aria-describedby` and `data-mdrs-*` attributes.
- Per tag:

    | Tag        | Attributes                                                     |
    | ---------- | -------------------------------------------------------------- |
    | `a`        | `href`, `target`, `rel`                                        |
    | `img`      | `src`, `alt`, `loading`, `decoding`, `width`, `height`         |
    | `source`   | `srcset`, `type`                                               |
    | `video`    | `src`, `controls`, `preload`, `playsinline`, `width`, `height` |
    | `iframe`   | `src`, `loading`, `allowfullscreen`                            |
    | `button`   | `type`                                                         |
    | `ol`       | `start`                                                        |
    | `td`, `th` | `align`, `colspan`, `rowspan`                                  |
    | `details`  | `open`                                                         |
    | `span`     | `style`                                                        |
    | `time`     | `datetime`                                                     |

- Event handlers (`on*`) are always removed.
- `href`, `src` and `srcset` must pass the same check as Markdown links: `http`, `https`, `mailto`, `tel` or relative. Media `src` must be absolute `http(s)`, root-relative, or a path without a scheme.
- `target` is only kept as `_blank`, and then `rel="noopener noreferrer"` is always added.
- `id` is only kept when it starts with `mdrs-`. Heading IDs are added after sanitizing and get the same prefix.
- `class` tokens are only kept in the MDRS namespace (`mdrs`, `mdrs-*`) or a third-party one the output relies on (`katex*`, `hljs*`, `language-*`, `bi`/`bi-*`). Inside KaTeX output any class is allowed except ones that would position content over the page (`fixed`, `absolute`, `sticky`, `inset-*`, `top-*`, `z-*`, …). See [Styling](../003-reference/003-styling.md).
- `style` (on `span` only) is kept only when every declaration is one of `position: relative`, `height`, `width`, `min-width`, `max-width`, `top`, `bottom`, `left`, `right`, `margin*`, `padding*`, `vertical-align`, `border-*-width` or `color`. This exists for KaTeX output.
- `iframe` is only kept for `https://www.youtube.com/embed/<id>` and `https://codepen.io/<user>/embed/<pen>`; any other iframe is removed with its content. Use `:::embed` rather than writing iframes by hand ([Media and embeds](../002-extensions/009-media-and-embeds.md)).

## Raw `<details>`

A hand-written `<details>`/`<summary>` gets the same styling and behaviour as the `:::details` directive. The directive is easier to read, though:

```mdrs
<details>
<summary>Raw HTML details</summary>

Markdown still works inside when blank lines surround it.

</details>
```

Source: `packages/lib/src/sanitizeHtml.ts`, `packages/lib/src/markdown.ts` (`parseDetailsBlocks`).
