# Frontmatter

A document can start with a block of YAML metadata, the same convention as MDX, Jekyll, Hugo and GitHub. MDRS treats it like a comment: it never shows up in the rendered page or in the `.txt` output.

```mdrs
---
title: Shipping MDRS
excerpt: What changed when the Markdown engine became a drop-in superset.
tags: [mdrs, markdown]
---

# Shipping MDRS

The body starts here.
```

Renders only the heading and the paragraph.

## Rules

- **Only at the very top.** The opening `---` must be the first line of the file. An optional byte-order mark is allowed, but no blank line before it.
- **Only one.** The block closes at the next line that is `---` (or `...`). Any later `---` line is an ordinary thematic break, as in plain Markdown.
- **YAML mapping.** The content has to parse as YAML and be a mapping of keys to values. Nesting is limited to 16 levels.
- **Drop-in fallback.** If the YAML doesn't parse, or isn't a mapping, the document renders exactly as plain Markdown would (a thematic break followed by text), and save validation reports `Frontmatter is not valid YAML: …` or `Frontmatter must be a YAML mapping of keys to values.`
- **Before `:::define`.** When both are present, the order is frontmatter, then the [`:::define`](013-variables.md) block, then the body.

```mdrs
---
title: Live counters
tags: [mdrs]
---
:::define
posts: api.v1.blog.length
:::

There are ${posts} published posts.
```

## Keys the admin understands

MDRS itself accepts any keys. The admin post editor's import button (the file icon in the Markdown editor's top bar) reads a `.md` or `.mdrs` file and fills the form:

| Key | Field | Notes |
| --- | --- | --- |
| `title` | Title | A string, at most 60 characters. |
| `excerpt` | Excerpt | A string, at most 250 characters, and required to publish. |
| `tags` | Tags | A list (`[a, b]`) or a comma-separated string, 1 to 5 tags of up to 30 characters. |

The rest of the file, without the frontmatter, becomes the post content. Other keys are ignored, and a toast names them. If the form already has content, the editor asks before replacing it. The stored post body never contains the frontmatter: the database columns hold that metadata.

[`SHOWCASE.md`](../SHOWCASE.md) is a complete example that imports cleanly.

Source: `packages/mdrs/src/frontmatter.ts` (`extractFrontmatter`, `importPostDocument`), `packages/mdrs/src/markdown.ts` (`renderMarkdownUnsafe`), `apps/admin/src/lib/components/admin/PostEditor.svelte`.
