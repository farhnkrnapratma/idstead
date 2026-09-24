<p align="center">
  <a href="https://fkp.my.id/">
    <img src="https://cdn.fkp.my.id/android-chrome-512x512.png" alt="Farhan Kurnia Pratama" width="200" height="200">
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

If you want to make sure your code is clean and that no line is unused or violates the linting rules, run these three commands:

```sh
bun run format
bun run lint
bun run check
```

Run `bun run test` for regression tests covering identity, banners, post saves, feedback, notifications, validation, translations, reading time, shortcuts, and API contracts. Database tests use disposable in-memory PGlite databases and never connect to Supabase. CI runs tests, type checking, linting, and a production build.

The admin dashboard uses Overview plus dedicated Reports, Feedback, and Notifications workspaces. Apply `supabase/migrations/20260913144335_scalable_admin_workspace.sql` after the existing activity migrations before deploying this UI. It adds service-role-only read/group-action RPCs and indexes; the public API and view-recording policy remain unchanged. Test migrations against an isolated database first. Index creation on populated tables can block writes, so schedule the production migration accordingly.

Workspace lists and event histories load 20 records at a time using cursors tied to the filter and arrival cutoff. The bell previews five groups. Reports aggregate per comment; feedback aggregates per page before pagination; notifications group by category, target, response, and calendar day in the selected time zone. New activity updates the unread summary and offers a refresh without moving the current results. Group deletion affects the displayed period and cutoff; clearing notifications preserves reports and feedback. Comments in Posts also load in pages, and deleting a parent removes its unloaded descendants.

Analytics default to seven calendar days and support up to one calendar year, including custom dates. Cards and zero-filled hourly/daily charts share the same half-open time interval. Current open-report and published-post counts are labeled separately. “Recorded reads” preserves the existing article/IP-hash deduplication policy and does not represent unique people. Chart data remains available in a table. Browser navigation retains workspace filters and selection. The interaction follows NN/g guidance on [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [complex applications](https://www.nngroup.com/articles/complex-application-design/), and [explicit empty states](https://www.nngroup.com/articles/empty-state-interface-design/).

`tests/admin-workspace.test.ts` covers aggregation, cursor boundaries, Unicode, authorization, time zones/DST, group-action scope, resolved notification context, and deletion of unloaded comment descendants. Browser and scale-test artifacts belong in ignored local development archives. Local benchmark timing is diagnostic; validate latency against the deployed database and representative traffic before setting an operational latency target.

The optional concurrency suite uses PostgreSQL 17 in a disposable Docker container named `www-admin-activity-test`, with database and user `postgres`. Start a fresh container with `docker run --rm -d --name www-admin-activity-test -e POSTGRES_PASSWORD=fixture postgres:17-alpine`, wait for `docker exec www-admin-activity-test pg_isready -U postgres`, then run `ACTIVITY_POSTGRES_TEST=1 bun test tests/admin-activity-concurrency.test.ts`. Override the container name with `ACTIVITY_POSTGRES_CONTAINER` when running simultaneous isolated suites. Stop the container afterwards. These tests create their own roles and schema; never point them at a shared database.

Build tooling lives in `tooling/vite`; the WebP plugin emits the decoder WASM required by the Cloudflare worker. `tooling/git-hooks` contains the secret-scan hook installed by `bun install`. Operational migration scripts remain in `scripts` until Production cutover is complete.

Generated knowledge graphs, agent observations, and local development archives are ignored by Git. Keep permanent regression tests and their fixtures under `tests`; keep session reports and manual browser harnesses local. Graphify can still query and update the local graph.

### Mailing commands

The command palette accepts `/mailing subscribe <email>` and `/mailing unsubscribe <email>`. Omitting the email opens an email form. Both actions require Turnstile verification and email confirmation; an unsubscribe request sends a confirmation link without changing the subscription. Mailing commands containing email addresses are excluded from search history.

The Subscribe button also supports `Ctrl+Space`, then `Shift+H`. An empty or invalid email focuses the field and shows its validation message. `POST /api/internal/subscribe/unsubscribe-request` is a first-party endpoint using the existing Supabase subscribers and Resend configuration; no new migration or public API change is required.

### Production cutover and asset cleanup

Application deployment and legacy source deletion are deferred. Preview and Production share Supabase and the R2 bucket, so writes from either tier affect the same data. Required server configuration includes `SUPABASE_SERVICE_ROLE_KEY`, private `IP_SALT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`, alongside the public Supabase settings. Retain `PUBLIC_CDN_BASE_URL` while the legacy identity fallback is needed. Never commit credentials.

The additive identity, banner, dashboard, and feedback migrations are retained in `supabase/migrations`. Identity assets, banner versions, and both page-feedback migrations have been applied to the shared project. Before rollout, compare the recorded migration history with the intended changes, including the partial-profile migration; older local and remote timestamps differ. Apply only verified missing migrations, preserving previously applied SQL and history. Do not use a bulk push or history repair to reconcile unrelated differences.

Keep the legacy `record_post_feedback` RPC available while older Production callers use it. Its article writes feed the same event ledger and rolling 24-hour quota as the server handler. Revoke browser-role execution only in a separate cutover migration after all callers have moved to the server endpoint. Feedback requires the private IP secret; it has no public-salt fallback.

Preserve `.local/blog-banner-migration/` with its resumable manifest, original sources, checksums, and reference inventory. The shared environment already has staged and activated banner versions; legacy source objects are retained. The operational script supports these steps for a new environment or a verified pending migration:

1. Run `bun scripts/migrate-blog-banners.ts inventory` to save the source/reference snapshot. Start a local server and run its `prepare` mode with `PLAYWRIGHT_MODULE` pointing to an installed Playwright module and `BANNER_TEST_ORIGIN` pointing to that server. Preparation uses the application's image worker and permits legacy-image upscaling only during migration.
2. Run `verify`, then `stage` and `activate` after the additive schema is available. Activation verifies staged objects and commits banner references atomically while retaining legacy paths. Reconcile content changes before proceeding; do not overwrite an activated manifest.
3. After authorized deployment, verify the editor, admin list, articles, related posts, social metadata, avatar, and manifest/icon aliases. Run `BANNER_PRODUCTION_ORIGIN=https://<production-origin> bun scripts/migrate-blog-banners.ts verify-production`.
4. Only after Production verification, use the same command with `cleanup-sources`. It verifies again and removes only migrated source objects recorded in the manifest, checking references and checksums. Unrelated Markdown, inline images, CVs, and identity assets remain excluded.

For legacy identity assets, `bun scripts/cleanup-legacy-identity.ts` is an offline dry run. After Production verification, its `--delete --origin=https://<production-origin>` mode verifies the application aliases and deletes only the explicit legacy root-key list. It never deletes prefixes, CVs, or versioned identity objects.

Rollback the application while retaining the additive schema, active objects, feedback history, and legacy sources. Do not restore the old lifetime feedback uniqueness constraint or delete current asset versions. Legacy source cleanup is a separate post-deployment operation; retain its scripts until that operation is complete.

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

## Article references

Use a single references directive to place a bibliography and automatically add a visible `References` heading to the article and its table of contents:

```markdown
A statement with a source[^source].

:::references

[^source]: Source description with a [link](https://example.com). :::
```

Footnote numbering and links back to each citation work across the document. Existing Markdown footnotes remain supported; their hidden accessibility heading is excluded from the table of contents. Unclosed or duplicate references blocks display a validation message in the editor preview.

The admin Overview calendar shows daily article views for the current calendar year in the selected time zone, independently of the Period selector. Feedback details show the selected period's helpful/unhelpful distribution. Notifications display individual events, with a blue background and unread marker until read. Admin activity lists and comment sections paginate at up to 20 items.

Apply `20260914062855_admin_calendar_notification_events.sql` after the preceding workspace migrations before deploying these admin changes. It replaces the internal workspace query, adds daily calendar aggregation, and retains service-role-only execution permissions.
