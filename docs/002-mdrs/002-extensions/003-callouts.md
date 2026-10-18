# Callouts

## Alerts

Five fixed alert types, each with its own icon, colour and title. The body is regular Markdown.

```mdrs
:::note
Background information the reader can safely skip.
:::

:::tip
A shortcut or best practice that saves time.
:::

:::important
A prerequisite or step that must not be skipped.
:::

:::warning
A deprecation, breaking change or surprising behaviour.
:::

:::caution
An action that risks data loss, security exposure or irreversible damage.
:::
```

| Directive      | Title     | Lucide icon              |
| -------------- | --------- | ------------------------ |
| `:::note`      | Note      | `info`                   |
| `:::tip`       | Tip       | `lightbulb`              |
| `:::important` | Important | `message-square-warning` |
| `:::warning`   | Warning   | `alert-triangle`         |
| `:::caution`   | Caution   | `circle-alert`           |

```html
<div class="mdrs-alert mdrs-alert--note">
    <div class="mdrs-alert-title">
        <svg class="mdrs-icon mdrs-icon-info">…</svg>
        <span>Note</span>
    </div>
    <div class="mdrs-alert-content">
        <p>Background information the reader can safely skip.</p>
    </div>
</div>
```

## GitHub alerts

GitHub's alert syntax renders the same callouts, so a README written for GitHub looks right in MDRS too:

```mdrs
> [!WARNING]
> The v1 API reshape broke `?id=` for drafts.
```

The marker must be alone on the first line of the quote and be one of `NOTE`, `TIP`, `IMPORTANT`, `WARNING` or `CAUTION` (in any case). The following `>` lines become the body. Any other quote, such as `> [!FOO]`, stays a plain blockquote. Alerts also work inside list items, but not inside a nested quote.

## Custom callouts

`:::callout` takes a required `title` and an optional `icon`:

```mdrs
:::callout title="Changelog" icon="list"
**v2.1**: added variables and live data.
:::

:::callout title="No icon"
The `icon` attribute is optional.
:::
```

```html
<div class="mdrs-callout">
    <div class="mdrs-callout-title">
        <svg class="mdrs-icon mdrs-icon-list">…</svg><span>Changelog</span>
    </div>
    <div class="mdrs-callout-content">
        <p><strong>v2.1</strong>: added variables and live data.</p>
    </div>
</div>
```

Without `title`, the block renders the error `:::callout requires title="..."`.

## Icons

The `icon` attribute (on `:::callout` and on `::tab`) accepts a [Lucide](https://lucide.dev/icons) or a [Bootstrap Icons](https://icons.getbootstrap.com) name in kebab-case.

| Value                  | Resolves to                                          |
| ---------------------- | ---------------------------------------------------- |
| `icon="rocket"`        | Lucide if it has the name, otherwise Bootstrap Icons |
| `icon="lucide-rocket"` | Lucide only                                          |
| `icon="bi-github"`     | Bootstrap Icons only                                 |
| an unknown name        | no icon, and no error                                |

```mdrs
:::callout title="Forced Lucide icon" icon="lucide-rocket"
Always the Lucide rocket.
:::

:::callout title="Forced Bootstrap icon" icon="bi-github"
Always the Bootstrap Icons GitHub logo.
:::
```

Lucide icons are inlined as SVG with `class="mdrs-icon mdrs-icon-<name>"` during rendering. Bootstrap Icons render as `<i class="mdrs-icon bi bi-<name>">` and rely on the Bootstrap Icons font the site loads.

Source: `packages/mdrs/src/markdown.ts` (`NOTE_CALLOUTS`, `renderContainer`, `convertGithubAlerts`), `packages/mdrs/src/icons.ts`.
