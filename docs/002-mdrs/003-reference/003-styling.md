# Styling and theming

Every class, ID and data attribute that MDRS generates starts with `mdrs`. The HTML carries no presentational utility classes: the default look lives in one stylesheet, so each site that uses MDRS can restyle the output without touching the engine.

## The contract

| Kind | Pattern | Example |
| --- | --- | --- |
| Root | `mdrs` on the element that wraps the rendered HTML (the consumer adds it) | `<div class="mdrs">` |
| Block | `mdrs-<block>` | `mdrs-callout`, `mdrs-details`, `mdrs-steps` |
| Part | `mdrs-<block>-<part>` | `mdrs-callout-title`, `mdrs-details-body` |
| Variant | `mdrs-<block>--<variant>` | `mdrs-alert--warning`, `mdrs-task--done`, `mdrs-list--loose` |
| State | `mdrs-is-<state>`, set by the client enhancers | `mdrs-is-active`, `mdrs-is-open`, `mdrs-is-checked` |
| Icon | `mdrs-icon mdrs-icon-<name>` | `mdrs-icon mdrs-icon-rocket` |
| ID | `mdrs-<slug>` | `## Main` → `id="mdrs-main"`, footnotes `mdrs-fn-1`, fallback `mdrs-heading-0` |
| Data attribute | `data-mdrs-<name>` | `data-mdrs-filename`, `data-mdrs-chart`, `data-mdrs-tab-label` |

The names are fixed rather than configurable, so they can be relied on like `.katex` or `.hljs`. Only third-party namespaces keep their own names: `katex*` (KaTeX's stylesheet), `hljs*` (highlight.js themes), `language-*` (the CommonMark convention highlighters read), `bi bi-*` (Bootstrap Icons font) and Mermaid's own SVG classes.

The sanitizer enforces the contract: on any element, a `class` token survives only if it matches one of those namespaces, and an `id` only if it starts with `mdrs-`. Raw HTML in a document follows the same rule, so `<div class="fixed inset-0">` loses both classes.

## Main blocks

| Construct | Classes |
| --- | --- |
| Lists | `mdrs-list` + `mdrs-list--unordered` / `--ordered` / `--loose`, items `mdrs-list-item`, bullet `mdrs-list-marker`, content `mdrs-list-content` |
| Task items | `mdrs-task mdrs-task--<state>` (`done`, `in-progress`, `failed`, `skipped`, `important`, `question`, `todo`), `mdrs-task-icon`, `mdrs-task-content`, label `mdrs-sr-only` |
| Tables | Wrapper `mdrs-table` |
| Alerts (`:::note` … `:::caution`, `> [!NOTE]`) | `mdrs-alert mdrs-alert--<kind>`, `mdrs-alert-title`, `mdrs-alert-content` |
| Custom callout | `mdrs-callout`, `mdrs-callout-title`, `mdrs-callout-content` |
| Details | `mdrs-details`, `mdrs-details-summary`, `mdrs-details-title`, `mdrs-details-icon`, `mdrs-details-body` |
| Tabs / snippets | `mdrs-tabs` or `mdrs-snippets`, `-header`, `-nav`, `-body`, `mdrs-snippets-actions`, buttons `mdrs-tab`, panels `mdrs-tab-panel` |
| Steps | `mdrs-steps`, `mdrs-steps-list`, `mdrs-step` |
| Code blocks (after enhancement) | `mdrs-code`, `mdrs-code-header`, `mdrs-code-body`, `mdrs-code-gutter`, `mdrs-code-line` (`--marked`, `--command`), `mdrs-code-line-number`, `mdrs-code-menu`, `mdrs-code-scrollbar` |
| Math | `mdrs-math mdrs-math--block`, `mdrs-math-error` |
| Diagrams and charts | `mdrs-mermaid`, `mdrs-mermaid-display`, `mdrs-mermaid-source`; `mdrs-chart`, `mdrs-chart-card`, `mdrs-chart-empty`, `mdrs-chart-error`, `mdrs-chart-tooltip` |
| Embeds | `mdrs-embed` |
| Footnotes | `mdrs-footnotes` (`mdrs-references` for a `:::references` block), `mdrs-footnote-backref` |
| Headings | `mdrs-heading`, `mdrs-heading-text`, `mdrs-anchor` |
| Errors | `mdrs-define-error` |

## Default stylesheet

The defaults live in `packages/lib/src/mdrs.css`, imported by `packages/lib/src/global.css` after the design system's styles. Every rule sits in Tailwind's `base` cascade layer, the lowest one. Any later layer (`components`, `utilities`) and any unlayered CSS therefore wins without a specificity fight:

```css
.mdrs-alert--note {
    border-color: rebeccapurple;
}

.mdrs-task--done > .mdrs-task-icon {
    color: seagreen;
}
```

For small changes, set the custom properties on `:root` or on one `.mdrs` container instead of writing selectors:

| Property | Default | Used for |
| --- | --- | --- |
| `--mdrs-color-heading` | `--color-text-primary` | Headings |
| `--mdrs-color-body` | `--color-text-secondary` | Body text |
| `--mdrs-color-link`, `--mdrs-color-link-hover` | `--color-accent`, `--color-accent-hover` | Links |
| `--mdrs-step-badge-size`, `--mdrs-step-line-width` | `1.375rem`, `1px` | Step badges and the connecting line |

```css
.mdrs.newsletter {
    --mdrs-color-body: #333;
    --mdrs-step-badge-size: 1.75rem;
}
```

The chart widget is a Svelte component styled with utilities. It exposes `mdrs-chart-*` hooks (`mdrs-chart-card`, `mdrs-chart-title`, …), which unlayered CSS can still override. The tooltip (`mdrs-chart-tooltip`) and the empty state (`mdrs-chart-empty`) take their default styling from `mdrs.css`, built on the shared `popover-surface` and `dashed-surface` utilities.

## Heading IDs and links

Heading IDs carry the prefix so they can't collide with the page around them. A post heading `## Main` used to produce a second `id="main"` next to the layout's `<main id="main">`. Short links keep working:

- Links inside the document (`[setup](#setup)`) are rewritten to `#mdrs-setup` when that heading exists (`prefixHashLinks`).
- A URL such as `/blog/post#setup` scrolls to `#mdrs-setup`. The post and legal pages resolve hashes with `resolveMdrsHash`, which prefers the prefixed ID inside the article.

Source: `packages/lib/src/mdrs.css`, `packages/mdrs/src/sanitize.ts` (`CLASS_TOKEN_RE`, `ID_RE`), `packages/mdrs/src/render/headings.ts` (`injectHeadingIds`, `prefixHashLinks`), `packages/lib/src/utils/headingAnchors.ts` (`resolveMdrsHash`).
