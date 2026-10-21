# Directives

Most MDRS block extensions share one syntax: a line that opens with `:::name`, Markdown content, and a bare `:::` line that closes the block. This page is the grammar; each directive has its own page.

```mdrs
:::callout title="Changelog" icon="rocket"
Any **Markdown**, including other directives.
:::
```

## Opening line

```text
:::name key="value" other="value"
```

- **Name**: a letter followed by letters or `-` (`[a-zA-Z][a-zA-Z-]*`). Names are case-insensitive, so `:::NOTE` works like `:::note`.
- **Attributes**: `key="value"` pairs separated by spaces. There are no braces and no commas.
    - Keys start with a letter and may contain letters, digits, `_` and `-`. Keys are case-insensitive.
    - Values must use double quotes. Inside a value, write `\"` for a quote and `\\` for a backslash.
    - Values are always HTML-escaped when rendered, so `title="<b>"` shows the text `<b>`.
    - Anything that isn't a `key="value"` pair (bare words, single-quoted values) is ignored.
- The opening line may be indented by up to three spaces, or prefixed with `>` inside a blockquote.

## Closing line

A line containing only `:::` (trailing spaces are fine) closes the innermost open block. Blocks without a body (`:::embed`) have no closing line.

## Nesting

Blocks nest freely: a `:::details` can hold a `:::note`, which can hold a code block, and so on. Each `:::` closes the most recently opened block.

```mdrs
:::details summary="Troubleshooting"
:::warning
Restart the dev server after changing environment variables.
:::

Still stuck? Open an issue.
:::
```

Nesting stops at 16 levels: deeper `:::name` lines are treated as text.

## Inside lists and blockquotes

A block can live inside a list item, indented to the item's content (up to three spaces), or inside a blockquote with every line prefixed by `>`:

```mdrs
- Step one
  :::tip
  Indented under the list item.
  :::

> :::caution
> Inside a blockquote.
> :::
```

Nested lists inside list-item containers are not supported.

## Fallbacks and errors

MDRS never drops content it doesn't understand:

| Situation | Result |
| --- | --- |
| Unknown name (`:::foo`) | The opening line, body and `:::` render as plain text |
| Block never closed | Rendered as plain text from the opening line onwards |
| More than 16 levels deep | The extra opening lines are plain text |
| Missing required attribute | A red inline error message such as `:::callout requires title="..."` |
| `:::` with no open block | Plain text |

Code spans and fenced code blocks are protected: a `:::note` line inside a code fence is never parsed.

```mdrs error
:::callout
`title` is missing, so this renders an error message.
:::
```

## All directives

| Directive | Closing `:::` | Page |
| --- | --- | --- |
| `:::note`, `:::tip`, `:::important`, `:::warning`, `:::caution` | yes | [Callouts](003-callouts.md) |
| `:::callout title="…" icon="…"` | yes | [Callouts](003-callouts.md) |
| `:::details summary="…"` | yes | [Details](004-details.md) |
| `:::tabs` with `::tab label="…" icon="…"` … `::` | yes | [Tabs and snippets](005-tabs-and-snippets.md) |
| `:::snippets key="…"` with `::tab` … `::` | yes | [Tabs and snippets](005-tabs-and-snippets.md) |
| `:::steps` (alias `:::step`) | yes | [Steps](006-steps.md) |
| `:::embed url="…"` | no | [Media and embeds](009-media-and-embeds.md) |
| `:::math` | yes | [Math](010-math.md) |
| `:::references` | yes | [References](012-references.md) |
| `:::define` | yes | [Variables](013-variables.md) |
| `:::ignore-render` | yes | [Escaping](015-escaping.md) |

`:::math`, `:::references`, `:::define` and `:::ignore-render` are handled in earlier passes than the other directives (see [Rendering pipeline](../003-reference/002-rendering-pipeline.md)), so they follow slightly stricter rules, which are listed on their pages.

Source: `packages/mdrs/core/src/render/attrs.ts` (`parseAttrs`), `packages/mdrs/core/src/render/containers.ts` (`CONTAINER_OPEN_RE`, `parseContainers`, `MAX_CONTAINER_DEPTH`).
