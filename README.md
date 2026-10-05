<p align="center">
  <a href="https://fkp.my.id/">
    <img src="https://fkp.my.id/android-chrome-512x512.png" alt="Farhan Kurnia Pratama" width="200" height="200">
  </a>
</p>
<h1 align="center">Farhan Kurnia Pratama</h1>
<h3 align="center">AI Engineering | Cybersecurity | Software Engineering | Linux/Unix</h3>
<p align="center">Security-focused Software Engineer specializing in AI Engineering, Cybersecurity, and Linux/Unix systems, focused on building secure, reliable, maintainable, and privacy-conscious software.</p>
<p align="center">
  <a href="https://fkp.my.id/">Home</a>
  ·
  <a href="https://fkp.my.id/#projects">Projects</a>
  ·
  <a href="https://fkp.my.id/#blog">Blog</a>
  ·
  <a href="https://fkp.my.id/#cv">CV</a>
  ·
  <a href="https://fkp.my.id/#funding">Funding</a>
  ·
  <a href="https://fkp.my.id/#contact">Contact</a>
</p>

---

## Get Started

### Prerequisites

Most of this project's tooling (formatting, linting, type-checking, building, etc.) and package management is handled with Bun. Install Bun and you're ready to start hacking. You can install Bun by running this command:

- Linux & macOS

```sh
curl -fsSL https://bun.sh/install | sh
```

- Windows

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

For more information about Bun, visit the official [Bun website](https://bun.com/).

### Install Dependencies

Before that, you need to clone or fork this repository (make sure you have [Git](https://git-scm.com/install/linux) installed). Simply run:

```
git clone https://github.com/farhnkrnapratma/www.git
cd <path_to_www>
```

Then install all dependencies before you start hacking by running this command:

```sh
bun install
```

### Configure Environment Variables

Copy the tier template that matches how you want to run locally, then fill in real values:

```sh
# Development-tier (default for local work) — dummy Turnstile, Sentry=development
cp .env.development.example .env.development
cp .env.development.example .env

# Or production-tier locally
cp .env.production.example .env.production
cp .env.production.example .env
```

`bun run dev` (Vite mode `development`) automatically loads `.env.development`, and `bun run build` loads `.env.production`.

The dev server will not start correctly without a valid `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` at minimum.

> **Dev server won't start / crashes immediately?** This is almost always a missing or invalid `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`. Double-check those two values first before looking anywhere else.

And that's it, you're ready to start hacking!

### Start Development Server

I use [Vite](https://vite.dev/) as the build tool and development server. You can start the development server by running this command:

```sh
bun run dev [--host]
```

You can omit `--host` if you don't need to preview the website on another device on the same network (e.g., a smartphone or tablet).

### Build for Production

You can build this project with [Vite](https://vite.dev/) by running this command:

```sh
bun run build
```

This command will generate a `.svelte-kit` folder in the project root.

### Preview Production Build

If you want to preview your website before deploying it, run this command:

```sh
bun run preview
```

### Code Quality Checks

If you want to make sure your code is clean, properly formatted, and passes all checks:

```sh
bun run format
bun run lint
bun run check
bun run test
```

## Public API

This site also publishes a public, read-only REST API under `/api/v1` (blog posts, author profile, search, comments, and more) — no authentication required. Full reference, error codes, and examples: [`src/routes/api/v1/README.md`](src/routes/api/v1/README.md), also served live at [`GET /api/v1`](https://fkp.my.id/api/v1). Machine-readable OpenAPI spec: [`/.well-known/openapi.json`](https://fkp.my.id/.well-known/openapi.json) / [`/.well-known/openapi.yaml`](https://fkp.my.id/.well-known/openapi.yaml).

## Deployment

The site deploys to [Cloudflare Pages](https://pages.cloudflare.com/) via [`@sveltejs/adapter-cloudflare`](https://kit.svelte.dev/docs/adapter-cloudflare), building to `.svelte-kit/cloudflare`. Cloudflare Pages is connected directly to this repository — there's no separate manual deploy step or GitHub Actions deploy job, and both tiers below build with the same `bun run build` command (Cloudflare Pages doesn't support a per-environment build command). Two tiers are configured in the Cloudflare Pages dashboard, each with its own environment variable set:

- **Production** — pushes to `main` deploy to `fkp.my.id`. Needs the variables in `.env.production.example`, including real `PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET` and `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Preview** — pushes to `develop` (and PRs) deploy to a `*.pages.dev` preview URL. Uses Cloudflare's [dummy Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) instead of real ones and `PUBLIC_SENTRY_ENVIRONMENT=preview`, so preview builds don't need a verified domain and don't pollute production error tracking.

Both tiers share the same Supabase project. Bindings (rate limiter, Workers AI) are declared in `wrangler.jsonc` and are shared across tiers too.

For local development against a given tier's config, copy the matching template on top of `.env` or use `.env.development` / `.env.production` — Vite layers `.env` → `.env.[mode]` automatically. This is a local-only convenience; it has no effect on what Cloudflare Pages deploys.

## Contributing

This repo uses [git-flow-next](https://git-flow.sh/) (classic preset: `main` for production, `develop` for integration, `feature/*`/`bugfix/*`/`release/*`/`hotfix/*` topic branches). See [`CLAUDE.md`](CLAUDE.md) for the full workflow, code style conventions, and architecture notes before opening a PR.

Found a security issue? Please don't open a public issue — see [`SECURITY.md`](SECURITY.md) for how to report it privately.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Markdown syntax

Posts and legal pages share one Markdown engine (`src/lib/markdown.ts`) built on `marked`, with MDX-flavoured directives. Directives open with `:::name`, close with a bare `:::`, take `key="value"` attributes separated by spaces (no braces), and can be nested. Attribute values are always HTML-escaped. Anything the engine does not recognise is left as literal text.

```text
[Link](https://example.com "Optional title")
![Alt text](/blog/content/<hash>.webp "Optional title")
![Clip](/blog/content/<hash>.mp4 "Optional title")
```

`.mp4` and `.webm` sources render as `<video>`, every other source as `<img>`.

````text
```python filename="main.py" mark=3,5,6..8
print("Hello, World!")
```
````

`filename` and `mark` are optional. `filename` is shown next to the language name and becomes the downloaded file name. `mark` highlights lines; ranges use `..`.

```text
:::note
:::tip
:::important
:::warning
:::caution

:::callout title="Changelog" icon="rocket"
Custom callout. `title` is required, `icon` is optional.
:::

:::details summary="Click to expand"
Collapsible content.
:::

:::tabs
::tab label="One" icon="zap"
Any Markdown.
::
::tab label="Two"
More Markdown.
::
:::

:::snippets key="pm"
::tab label="bun" icon="terminal"
Code blocks. The optional `key` keeps every snippet group with the same key on the same tab.
::
:::

:::steps
1. First
2. Second
:::

:::embed url="https://youtu.be/VIDEO_ID"
```

Icons accept Lucide and Bootstrap Icons names. Without a prefix Lucide is tried first, then Bootstrap Icons; use `icon="lucide-rocket"` or `icon="bi-facebook"` to pick a library. Unknown names render no icon. `:::embed` supports YouTube and CodePen and falls back to a plain link.

```text
Inline math: $$ e^{i\pi} + 1 = 0 $$

:::math
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
:::
```

Math is rendered with KaTeX on the server. A single `$` is plain text.

Containers and `:::math` also work inside list items (`-`, `*`, `1.` with the content indented under the marker, up to three spaces) and blockquotes (`> :::note`). Nested lists are not supported.

All rendered HTML passes through an allowlist sanitizer (`src/lib/sanitizeHtml.ts`): scripts, event handlers, unknown tags, foreign iframes and `javascript:` URLs are removed, whether they come from an author or from an AI translation. Raw `kbd`, `sub`, `sup`, `u`, `mark`, `details` and `br` still work.

### Article references

Use a single references directive to place a bibliography and automatically add a visible `References` heading to the article and its table of contents:

```text
A statement with a source[^source].

:::references
[^source]: Source description with a [link](https://example.com).
:::
```

Footnote numbering and links back to each citation work across the document. Existing Markdown footnotes remain supported; their hidden accessibility heading is excluded from the table of contents. Unclosed or duplicate references blocks display a validation message in the editor preview. Put a blank line before the closing `:::`, otherwise Markdown formatters treat it as part of the last footnote.
