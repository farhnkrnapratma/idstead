# Conditionals

Conditionals show or hide parts of a document depending on a boolean expression. Block conditionals choose whole paragraphs, lists or headings; inline conditionals choose text inside a line. Both use the expression language of [Variables](013-variables.md) and can read [live data](014-live-data.md).

## Block conditionals: `:::if`

```mdrs
:::if api.v1.analytics.enabled
This site measures visits with ${api.v1.analytics.name}.
:::elif api.v1.analytics.provider == "none"
This site uses no analytics.
:::else
Analytics are being set up.
:::endif
```

- `:::if`, `:::elif`, `:::else` and `:::endif` each stand on their own line, indented by at most three spaces. The condition is the rest of the `:::if` or `:::elif` line.
- The first branch whose condition is `true` renders; `:::else` renders when none is. `:::elif` and `:::else` are optional, and `:::else` comes last.
- A condition must evaluate to a boolean. `:::if api.v1.blog.length` is an error; write `:::if api.v1.blog.length > 0`.
- Blocks nest up to 16 levels deep.
- Block conditionals work without a `:::define` block, so a page can test `api.v1.*` without declaring variables. With a `:::define` block, conditions can also use its variables.
- The branches can hold any Markdown and MDRS, including directives, code blocks and `${…}`.

```mdrs
:::define
cookies: true
:::

:::if cookies
:::if api.v1.analytics.provider == 'ga4'
Google Analytics sets cookies only after you agree.
:::else
Cookies are set only after you agree.
:::endif
:::endif
```

## Inline conditionals: `${if}`

```mdrs
:::define
stable: false
version: "2.1"
:::

This is ${if stable}the **stable** release${else}preview build ${version}${endif}.
```

Renders "This is preview build 2.1."

- `${if cond}text${elif cond}text${else}text${endif}`, with `${elif}` and `${else}` optional.
- The text between the markers can hold Markdown and `${…}`, and can span lines inside one paragraph.
- Inline conditionals nest up to eight levels deep.
- Like `${…}`, they only work in a document that starts with a `:::define` block.

For a short value, the ternary operator is often enough: `${stable ? "stable" : "preview"}`.

## Examples with analytics

```mdrs
:::define
on: api.v1.analytics.enabled
:::

Analytics: ${if on}**on** (${api.v1.analytics.name})${else}off${endif}.

This site ${if api.v1.analytics.cookies}sets cookies only after you agree${else}sets no cookies${endif}.

Provider: ${if api.v1.analytics.provider == "ga4"}Google Analytics${elif api.v1.analytics.provider == "umami"}Umami${else}none${endif}.
```

## What is not interpreted

- Code spans, fenced code blocks and `:::verbatim` blocks: `:::if` and `${if}` stay literal there. See [Escaping](015-escaping.md).
- `\${if x}` in a document with `:::define` renders `${if x}`.
- `:::if` inside a blockquote or a list item is plain text; put the conditional around the whole blockquote or list.

## Rendering and exports

Conditionals run on the server after the `:::define` block is evaluated and before interpolation and directives. The page, its `.md` and `.txt` exports and the admin preview all show the same branch. A document whose conditions read `api.*` is live data: its render refreshes like any other live-data page ([Live data](014-live-data.md)).

## Errors

| Message | Cause |
| --- | --- |
| `Expected a boolean condition, got a number: …` | The condition is not a boolean |
| `':::else' has no matching :::if` | `:::elif`, `:::else` or `:::endif` without an open `:::if`, or a branch after `:::else` |
| `':::if cond' is never closed with :::endif` | A missing `:::endif` |
| `${else} has no matching ${if}` | The inline form of the same mistake |
| `'${if cond}' is never closed with ${endif}` | A missing `${endif}` |
| `${if} is nested more than 8 levels deep` | Too many nested inline conditionals |

A condition that fails to evaluate renders a `[define error]` marker in place of the conditional. An unmatched or unclosed `:::if` line renders as plain text, and an unmatched or unclosed `${if}` marker renders a `[define error]` marker. Saving runs `validateDefineForSave`, which evaluates every condition of every branch and reports these messages, so a post or legal page can't be saved with them.

Source: `packages/mdrs/core/src/define/conditionals.ts` (`resolveConditionals`, `conditionSources`), `packages/mdrs/core/src/markdown.ts`, `packages/mdrs/core/src/define/validate.ts`, `packages/mdrs/core/src/liveData.ts` (`usesLiveData`).
