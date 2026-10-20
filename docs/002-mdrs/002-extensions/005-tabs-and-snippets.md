# Tabs and snippets

Two directives show alternative content one panel at a time:

- `:::tabs` is for prose: any Markdown per tab.
- `:::snippets` is for code: it adds copy and download controls for the active tab, and can keep several groups on the same tab.

Both are made of `::tab` sections, each closed with `::`.

## `:::tabs`

```mdrs
:::tabs
::tab label="Server-side rendering" icon="server"
The full HTML is built on the server, so search engines and slow devices see real content.
::
::tab label="Client-side rendering" icon="monitor"
A minimal shell is sent and the page is built in the browser.
::
:::
```

- `label` is required on every `::tab`. `icon` is optional and follows the same rules as [callout icons](003-callouts.md#icons).
- The first tab is selected initially.
- Tabs can hold any Markdown, including other directives such as `:::steps` or `:::note`.

```html
<div class="mdrs-tabs">
    <div
        class="mdrs-tabs-header"
        role="tablist">
        <div class="mdrs-tabs-nav">
            <button
                type="button"
                role="tab"
                class="mdrs-tab mdrs-is-active"
                data-mdrs-tab-label="Server-side rendering"
                aria-selected="true">
                …Server-side rendering
            </button>
            <button
                type="button"
                role="tab"
                class="mdrs-tab"
                data-mdrs-tab-label="Client-side rendering"
                aria-selected="false">
                …
            </button>
        </div>
    </div>
    <div class="mdrs-tabs-body">
        <div
            role="tabpanel"
            class="mdrs-tab-panel">
            <p>The full HTML is built on the server, …</p>
        </div>
        <div
            role="tabpanel"
            class="mdrs-tab-panel"
            hidden>
            …
        </div>
    </div>
</div>
```

## `:::snippets`

````mdrs
:::snippets key="pm"
::tab label="bun" icon="terminal"
```sh
bun add katex
```
::
::tab label="npm" icon="package"
```sh
npm install katex
```
::
:::
````

- The header bar carries the copy button and the options menu (download, wrap, line numbers, clean mode) of [code blocks](007-code-blocks.md). They act on the code in the active tab.
- Each panel shows a small `filename · language` badge when the code block has `filename="…"`, otherwise just the language.
- A snippets group renders as `div.mdrs-snippets` with `mdrs-snippets-header`, `mdrs-snippets-nav`, `mdrs-snippets-actions` and `mdrs-snippets-body`; the key is stored in `data-mdrs-tab-key`.
- `key` is optional. All `:::snippets` groups on a page that share a `key` stay in sync: picking "npm" in one switches every other group with a tab labelled "npm". The selection lasts until the page is reloaded.

````mdrs
:::snippets key="pm"
::tab label="bun"
```sh
bun run dev
```
::
::tab label="npm"
```sh
npm run dev
```
::
:::
````

## Keyboard

When a tab group has focus, <kbd>1</kbd> to <kbd>9</kbd> select the first nine tabs. Snippet groups also get the code block shortcuts (<kbd>C</kbd> copy, <kbd>O</kbd> options, <kbd>D</kbd> download).

## Rules and errors

- `::tab` and `::` are only recognised directly inside `:::tabs` or `:::snippets`, at the same blockquote depth as the opening line. Elsewhere they are plain text.
- Text before the first `::tab` is ignored.
- A group with no `::tab` renders `:::tabs requires at least one ::tab` (or `:::snippets …`).
- A `::tab` without `label` renders `Every ::tab in :::tabs requires label="..."`.

```mdrs error
:::tabs
::tab icon="zap"
This tab has no label.
::
:::
```

Source: `packages/mdrs-core/src/render/containers.ts` (`TAB_OPEN_RE`, `renderTabs`), `packages/mdrs-dom/src/tabs.ts`.
