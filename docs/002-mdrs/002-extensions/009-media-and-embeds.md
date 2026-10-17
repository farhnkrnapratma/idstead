# Media and embeds

## Video with the image syntax

Images and videos share one syntax: `![alt](source "title")`. A source ending in `.mp4` or `.webm` (query strings and fragments allowed) renders a `<video>` with controls; anything else renders an image.

```mdrs
![Product demo](https://cdn.fkp.my.id/blog/my-post/videos/product-demo.webm "Product demo")
```

```html
<video
    controls
    preload="metadata"
    playsinline
    src="https://cdn.fkp.my.id/blog/my-post/videos/product-demo.webm"
    title="Product demo"
    aria-label="Product demo"></video>
```

The alt text becomes the video's `aria-label`.

## Post images: AVIF with a WebP fallback

Images uploaded for a post live on the CDN as an AVIF file with a WebP sibling. When the source matches `https://<host>/blog/<slug>/images/<name>.avif` (or the `staging/blog/<uuid>/images/…` path used before a post is first saved), MDRS renders a `<picture>`:

```mdrs
![Architecture overview](https://cdn.fkp.my.id/blog/my-post/images/architecture-overview.avif "Architecture overview")
```

```html
<picture
    ><source
        srcset="https://cdn.fkp.my.id/blog/my-post/images/architecture-overview.avif"
        type="image/avif" />
    <img
        src="https://cdn.fkp.my.id/blog/my-post/images/architecture-overview.webp"
        alt="Architecture overview"
        title="Architecture overview"
        loading="lazy"
        decoding="async"
/></picture>
```

Any other image URL renders a plain `<img>` ([Links and images](../001-markdown/003-links-and-images.md#images)).

## Uploading from the editor

The admin editor's upload button inserts the right syntax for you:

- The file name is the slugified original name.
- The alt text and the title are the same sentence-case text derived from the file name, with acronyms kept.
- Video uploads must be WebM.

## `:::embed`

A single line, without a closing `:::`, embeds a video or a pen in a responsive 16:9 frame:

```mdrs
:::embed url="https://youtu.be/VyPwEZTIpVc"

:::embed url="https://www.youtube.com/watch?v=VyPwEZTIpVc"

:::embed url="https://codepen.io/user/pen/abcdef"
```

| Provider | Recognised URLs | Embedded as |
| --- | --- | --- |
| YouTube | `youtube.com/watch?v=…`, `youtube.com/shorts/…`, `youtube.com/embed/…`, `youtu.be/…` (`www.` and `m.` included) | `https://www.youtube.com/embed/<id>` |
| CodePen | `codepen.io/<user>/pen/<id>` | `https://codepen.io/<user>/embed/<id>?default-tab=result` |

```html
<div class="mdrs-embed">
    <iframe
        src="https://www.youtube.com/embed/VyPwEZTIpVc"
        loading="lazy"
        allowfullscreen
        title="Embedded content"></iframe>
</div>
```

Other URLs fall back to a plain external link that opens in a new tab. A URL that isn't `http(s)` renders as plain text, and a missing `url` renders `:::embed requires url="..."`.

```mdrs
:::embed url="https://example.com/some-video"
```

```html
<a
    href="https://example.com/some-video"
    target="_blank"
    rel="noopener noreferrer"
    >https://example.com/some-video</a
>
```

Extra query parameters such as `?si=…` or `&t=30s` are not carried into the embed.

Source: `packages/lib/src/markdown.ts` (`image` renderer, `VIDEO_EXT_RE`, `POST_IMAGE_RE`, `renderEmbed`), `packages/lib/src/assetNaming.ts`, `packages/lib/src/sanitizeHtml.ts` (iframe allowlist).
