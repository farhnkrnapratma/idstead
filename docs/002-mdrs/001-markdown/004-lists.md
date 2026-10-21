# Lists

## Bulleted lists

Start each item with `-`, `*` or `+` followed by a space.

```mdrs
- SvelteKit
- Supabase
- Cloudflare Workers
```

MDRS draws its own bullet instead of the browser's list marker, so the HTML carries extra wrappers:

```html
<ul class="mdrs-list mdrs-list--unordered">
    <li class="mdrs-list-item">
        <span
            class="mdrs-list-marker"
            aria-hidden="true"></span>
        <div class="mdrs-list-content">SvelteKit</div>
    </li>
    …
</ul>
```

## Numbered lists

Start each item with a number followed by `.`. The first number sets where the list starts; the numbers after it don't matter.

```mdrs
3. Three
4. Four
5. Five
```

```html
<ol
    start="3"
    class="mdrs-list mdrs-list--ordered">
    <li class="mdrs-list-item">Three</li>
    …
</ol>
```

## Nested lists and multi-paragraph items

Indent the child content to line up with the text of its parent item (two spaces after `-`, three after `1.`).

```mdrs
1. Provision the database
2. Configure rendering:
   - KaTeX on the server
   - Mermaid in the browser
3. Ship it

- An item with two paragraphs.

  The second paragraph, indented under the item.
```

As in CommonMark, a tight list (no blank lines between items) renders its text without `<p>`, and a loose list (items separated by blank lines) keeps a `<p>` around every paragraph. A loose list also gets the `mdrs-list--loose` class, which spaces its paragraphs apart.

```mdrs
- First

- Second
```

```html
<ul class="mdrs-list mdrs-list--unordered mdrs-list--loose">
    <li class="mdrs-list-item">
        …
        <div class="mdrs-list-content"><p>First</p></div>
    </li>
    …
</ul>
```

## Task lists

GFM task list items start with `[ ]` (open) or `[x]` (done).

```mdrs
- [x] Write the docs
- [ ] Reserve the package names
```

MDRS replaces the checkbox with an icon (a checked or an empty square) and supports five more states: `[*]`, `[/]`, `[-]`, `[!]` and `[?]`. See [Task states](../002-extensions/008-task-states.md).

Task items work in numbered lists too. The item keeps its number and shows the state icon after it:

```mdrs
1. [x] Reserve the name
2. [ ] Publish the first release
```

## Containers inside list items

Directives such as `:::note` and `:::math` also work inside list items, as long as they're indented under the item text (up to three spaces):

```mdrs
1. Install the dependencies.
   :::tip
   Use `bun install` at the repository root.
   :::
2. Start the dev server.
```

Source: `packages/mdrs/core/src/render/parser.ts` (`list` renderer), `packages/mdrs/core/src/render/tasks.ts` (`cleanListItemHtml`), `packages/mdrs/core/src/render/containers.ts` (`parseContainers`).
