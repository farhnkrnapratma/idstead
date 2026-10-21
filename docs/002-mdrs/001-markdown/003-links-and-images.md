# Links and images

## Inline links

```mdrs
[Link text](https://example.com)
[With a title](https://example.com "Shown as a tooltip")
[Relative link](/blog)
[Section on this page](#images)
```

## Reference links

Define the URL once, anywhere in the document, and refer to it by label. Labels are case-insensitive.

```mdrs
Read the [CommonMark spec][spec] or just [spec].

[spec]: https://spec.commonmark.org "CommonMark Spec"
```

## Autolinks

GFM turns bare URLs, `www.` addresses and e-mail addresses into links. Angle brackets force an autolink.

```mdrs
https://example.com, www.example.com, foo@bar.com and <https://commonmark.org>
```

```html
<a
    href="http://www.example.com"
    …
    >www.example.com</a
>
and <a href="mailto:foo@bar.com">foo@bar.com</a>
```

## URL safety

Only `http:`, `https:`, `mailto:` and `tel:` URLs are kept, plus relative URLs and `#fragments`. Any other scheme (`javascript:`, `data:`, `vbscript:`, …) is replaced with `#`. Whitespace and control characters hidden inside the scheme are ignored by the check, so they can't smuggle a `javascript:` URL through.

```mdrs
[Mail me](mailto:hello@example.com) · [Call](tel:+620000) · [Blocked](javascript:alert(1))
```

```html
<a href="mailto:hello@example.com">Mail me</a> · <a href="tel:+620000">Call</a> ·
<a href="#">Blocked</a>
```

## External links

An absolute `http(s)` link to another site opens in a new tab and gets a small external-link icon. Links to `my-site.example` and `www.my-site.example`, and relative links, stay in the same tab.

```mdrs
[Internal](https://my-site.example/blog) and [external](https://example.com)
```

```html
<a href="https://my-site.example/blog">Internal</a> and
<a
    href="https://example.com"
    class="mdrs-external-link"
    target="_blank"
    rel="noopener noreferrer"
    >external<svg class="mdrs-icon mdrs-icon-external-link">…</svg></a
>
```

## Images

```mdrs
![Alt text](https://example.com/diagram.png "Optional title")
```

```html
<img
    src="https://example.com/diagram.png"
    alt="Alt text"
    title="Optional title"
    loading="lazy"
    decoding="async" />
```

- The alt text is plain text: formatting inside it (`![A *b*](…)`) is flattened to `A b`.
- Every image is lazy-loaded and decoded asynchronously.
- An image whose URL fails the URL safety check renders as its alt text only.
- Reference-style images (`![Alt][label]`) work like reference links.

MDRS also uses the image syntax for videos and serves post images as AVIF with a WebP fallback; see [Media and embeds](../002-extensions/009-media-and-embeds.md).

Source: `packages/mdrs/core/src/render/parser.ts` (`link` and `image` renderers), `packages/mdrs/core/src/sanitize.ts` (`sanitizeUrl`).
