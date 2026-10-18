# Steps

`:::steps` turns a list, or a series of headings, into a numbered timeline with connecting lines. `:::step` is an alias.

## List form

Use a numbered or bulleted list; bullets are converted to numbered steps.

```mdrs
:::steps
1. Clone the repository.
2. Run `bun install`.
3. Start the dev server with `bun run dev`.
:::
```

```html
<div class="mdrs-steps">
    <ol class="mdrs-steps-list">
        <li class="mdrs-step">Clone the repository.</li>
        <li class="mdrs-step">Run <code>bun install</code>.</li>
        <li class="mdrs-step">Start the dev server with <code>bun run dev</code>.</li>
    </ol>
</div>
```

## Heading form

When the block contains no list, each `##`, `###` or `####` heading starts a step, and everything until the next heading belongs to it. This form suits steps that need several paragraphs or code blocks.

````mdrs
:::steps
Text before the first heading stays above the timeline.

### Install dependencies

```sh
bun add katex mermaid
```

### Configure rendering

Wire KaTeX into the server render.

### Verify and ship

```sh
bun run check && bun run lint
```
:::
````

```html
<div class="mdrs-steps">
    <p>Text before the first heading stays above the timeline.</p>
    <div class="mdrs-step">
        <h3>Install dependencies</h3>
        <pre>…</pre>
    </div>
    <div class="mdrs-step">
        <h3>Configure rendering</h3>
        …
    </div>
</div>
```

Step headings are normal headings: they get IDs and appear in the table of contents.

## Notes

- If the block contains a list, the list form wins and headings are left as they are.
- Steps work inside tabs, details and callouts.

Source: `packages/mdrs/src/markdown.ts` (`renderContainer`, `parseSteps`).
