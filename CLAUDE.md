# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Idstead**: a self-hostable personal site and identity home (profile, blog, projects, CV, funding and contact pages, an admin portal and a public API) — SvelteKit 5 + TypeScript + Tailwind CSS 4, backed by Supabase (Postgres + RLS), deployed as Cloudflare Workers. Anyone can run an instance with their own data; the owner's instance is described under [This instance](#this-instance). A Bun-workspaces monorepo with four deployables that share a library, a design system, domain helpers and the MDRS engine. Worker names and hosts below are the defaults from `idstead.example.jsonc` for the site `example.com`:

| Workspace | Worker | Host | Role |
| --- | --- | --- | --- |
| `apps/web` | `idstead-web` | `example.com` (+ `www.`) | Public site: homepage, `/blog`, posts, legal pages, feeds, `.well-known`, first-party `/api/internal/**` and `/api/ard/**`. |
| `apps/admin` | `idstead-admin` | `admin.example.com` | Admin portal at the host root plus `/api/internal/admin/**`. |
| `apps/api` | `idstead-api` | `api.example.com/v1` | Public read-only REST API (Hono). |
| `apps/jobs` | `idstead-jobs` | none | Queue consumer (`idstead-newsletter`), daily cron cleanups and post render refreshes. |
| `packages/lib` | — | — | `@idstead/lib`: site feature components, data access, server helpers, API handlers. |
| `packages/ui` | — | — | `@idstead/ui`: the design system: tokens, global styles, UI primitives, layout primitives, UI stores and the keyboard shortcut system. |
| `packages/domain` | — | — | `@idstead/domain`: pure, framework-free helpers and types (formatters, read time, slugs, pagination, validation, sanitizers, public post DTOs). |
| `packages/data` | — | — | `@idstead/data`: the server-only data layer: repository ports and their Supabase adapters. |
| `packages/mdrs/core` | — | — | `@mdrs/core`: the standalone MDRS engine (render, `:::define`, frontmatter, sanitizer, legacy migration). |
| `packages/mdrs/dom` | — | — | `@mdrs/dom`: the browser side of MDRS (code blocks, tabs, charts, Mermaid, heading anchors) and `mdrs.css`. |
| `packages/mdrs/editor` | — | — | `@mdrs/editor`: the Markdown/MDRS editor (`MarkdownEditor`). |

## Commands

Package manager is **bun** — never use npm/npx/yarn/pnpm in this repo (`bun.lock` is the lockfile; use `bun`/`bunx` for everything, including one-off tool invocations). Bun uses the hoisted linker (`bunfig.toml`).

```sh
bun install              # install every workspace
bun run configure        # render apps/*/wrangler.jsonc from idstead.jsonc (bun run check verifies them)
bun run setup [apply]    # set up an instance: config, Cloudflare resources, admin user, legal pages, deploy (dry run by default)
bun run dev [--host]     # web dev server (apps/web, mode: development)
bun run dev:admin        # admin dev server on :5174
bun run --filter @idstead/api dev   # API worker via wrangler dev on :8787
bun run --filter @idstead/jobs dev  # jobs worker via wrangler dev --test-scheduled on :8788
bun run build            # build every app (SvelteKit builds + wrangler dry-run bundles)
bun run test             # Bun regression tests in tests/
bun run check            # svelte-check for web/admin, tsc for api/jobs/mdrs
bun run lint             # prettier --write . && eslint .
bun run fmt / fmt:check  # prettier
```

Run tests, `bun run check`, and `bun run lint` after non-trivial changes (repository changes must keep the suites in `tests/contracts/` passing; every adapter runs them); there is no CI pipeline, so these local runs are the only gate before Workers Builds deploys. `tests/` stays at the repository root and imports from `packages/lib/src` and `apps/*/src`. Build plugins, Git hooks and `tooling/lib-usage.ts` (which app reaches each lib file) live in `tooling/`; `scripts/` holds operational migration commands (`migrate-markdown-syntax.ts`, `regenerate-post-slugs.ts`, `migrate-cdn-layout.ts`, all dry-run by default). `tooling/setup.ts` (pure parts in `tooling/setup/plan.ts`) is the setup script described in [Getting started](docs/001-getting-started/README.md); the `setup-idstead` skill (`.agents/skills/`, linked from `.claude/skills/`) drives it for agents, and `templates/legal/` holds the starter legal pages it seeds.

Where the instance runs (domains, Worker, bucket and queue names, rate limiter namespaces, cron) lives in `idstead.jsonc`; edit it and run `bun run configure` instead of editing `apps/*/wrangler.jsonc`, which is generated from `apps/*/wrangler.template.jsonc` ([Instance configuration](docs/002-configuration/001-instance.md)). Env files stay at the repository root (`apps/*/vite.config.ts` set `envDir` and SvelteKit's `env.dir` to `../..`). Values come from a root `.env` or a secret manager that starts the process (this instance uses Phase, see [This instance](#this-instance)); `.env.example` lists every key once. At minimum `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Other vars: `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_URL` (both required: `apiBaseUrl()` and `configuredSiteUrl()` throw when they are missing; the site URL is used when the profile has none, for newsletter links, CV verification-bundle links and the admin's generated website banner), `PUBLIC_STATUS_PAGE_HOST`/`PUBLIC_STATUS_PAGE_CODE` (optional Instatus page for the footer badge; the badge is hidden without them), `PUBLIC_GA_MEASUREMENT_ID` (optional Google Analytics 4 property; no analytics script loads without it), `SENTRY_ORG`/`SENTRY_PROJECT` (build-time source-map upload), the `R2_*` keys (S3-API access for `scripts/migrate-cdn-layout.ts` only; the web, admin and jobs Workers reach the R2 bucket named by `assetBucket` in `idstead.jsonc` for CV and image storage through the `ASSET_BUCKET` binding), Sentry, Turnstile, Resend (`RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL` — newsletter and contact form), `IP_SALT`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS), `CLOUDFLARE_API_TOKEN` (wrangler auth, needed for the `AI` binding's `remote: true` mode in local dev). The wrangler workers (`api`, `jobs`) declare their secrets in `secrets.required` in `wrangler.jsonc`, so `wrangler dev` reads them from the environment locally and deploys fail if one is missing on the Worker; add a name there when a worker starts reading a new one. In production every Worker reads Worker secrets ([Environment variables](docs/002-configuration/002-environment.md#worker-secrets)); `bun run setup` uploads each Worker's keys with its deploy.

## Architecture

### Shared library (`packages/lib`)

Every app imports shared code as `#lib/...`. Each app's `package.json` maps `#lib/*` to `@idstead/lib/*`, and `@idstead/lib` exports `./*` from `src/*`, so the import paths are identical everywhere. Svelte apps type-check `packages/lib/src` through their own `tsconfig.json`; lib code must therefore type-check in both web and admin (no app-specific typed `resolve()` routes in lib).

- `src/components/` — the components both apps use (CommentThread, BrandIcon); `src/article/ArticleMeta.svelte`. UI primitives live in `@idstead/ui`; components used by only one app live in that app (below).
- `src/global.css` — the app stylesheet entry: it imports `@idstead/ui/styles/global.css` (Tailwind, fonts, tokens), scans lib with `@source './'` and adds `mdrs.css`. Apps import `#lib/global.css` in their root layout; lib component `<style>` blocks `@reference` it relatively.
- `src/server/` — server-only helpers: `apiError`, `apiEnvelope` (public `{error:{...}}` wrapping), `rateLimit`, `r2` (the `ASSET_BUCKET` R2 binding), `workerEnv` (Cloudflare bindings through `cloudflare:workers`; `event.platform` is always undefined with adapter-cloudflare 8), `csp`, `subscriberBroadcast`, `newsletterQueue`, and `api/` (API handlers).
- `src/apiConfig.ts` — `apiUrl()`/`apiBaseUrl()` for links to the API host from web pages.

### Public API (`apps/api`)

Full endpoint reference and error-code table: [apps/api/src/README.md](apps/api/src/README.md) — served live at `GET /v1`, with `{{API_BASE_URL}}` and `{{SITE_URL}}` filled from the request origin and the profile's site URL by `renderReadme()`. Read it before adding/changing any API route. `apps/api/src/index.ts` is a Hono app; endpoint logic lives in `packages/lib/src/server/api/` (`blog.ts`, `author.ts`, `root.ts`) and routes only wrap it in `runApi()`. Key conventions:

- **Error envelope**: handlers return a flat `{code, message, details?}` body via `apiError()` or throw `ApiRequestError`; the worker middleware wraps it with `apiErrorEnvelope()` into the public `{error: {...}}` shape. Never hand-roll error JSON.
- **Error codes** are stable and per-endpoint (e.g. `BLOG_POST_NOT_FOUND`) — add new codes to both the handler and the README table.
- **Versioning**: breaking changes ship under a new `/v2/`, never in place under `/v1`. The October 2026 v1 reshape and move to the `api.` host were one-time exceptions; don't treat them as precedent.
- **Read-only**: the API worker answers `GET`/`HEAD`/`OPTIONS` only (`405` otherwise). Anything that writes data lives under `/api/internal/**` on web or admin — unversioned, undocumented, first-party-only, gated by `isSameOriginRequest()` where there's no other auth.
- **CORS, rate limiting (60 req/min/IP via `API_RATE_LIMITER`, in-memory fallback), ETags and `Vary: Accept`** are handled centrally in the worker middleware.
- **Parameters**: parse every query string with `parseApiParams(url, allowed)` (`server/api/params.ts`). Full names and one-letter aliases: `field`/`f`, `output`/`o`, `query`/`q`, `page`/`p`, `limit`/`n`, `checksum`/`c`; `id` has none. Unknown parameters → `400 UNKNOWN_PARAMETER`; name+alias together → `400 PARAM_CONFLICT`. Single resources use `?id=`, never a path segment.
- **Representations**: JSON by default except `GET /v1` and `/v1/blog/content` (markdown). `output` (via `resolveOutput`) overrides `Accept`. `/v1/cv` must stay byte-identical to `/v1/author?field=cv`.
- **No database IDs in public output**: posts are identified by `db_posts.public_id` (64 hex, immutable), resolved with `BlogRepository.findPublished()` (full ID, slug, or unique ≥7-char prefix), and comments by `db_comments.public_id`. Never return UUIDs or `*_id` columns from the API, page data, feeds, or banner URLs.
- Keep `packages/lib/src/openapi.ts` (paths are `/v1/...`) in sync with any route/schema change; the worker serves it at `/v1/openapi.{json,yaml}` and web mirrors it at `/.well-known/openapi.{json,yaml}`.

### Public site (`apps/web`)

- Site pages live in the `(site)` route group, whose layout renders `SkipLink` and `SiteNav` (a floating tool bar, without a container, holding Spotlight search, theme and accessibility settings; there are no section links or mobile tab bar, so pages are reached through each section's "see all" link, the footer or slash commands) once and preloads every section's code when the browser is idle: `/` (profile, two experience entries, one education entry, the three newest unpinned posts, the two most recently pushed unpinned projects, each linking to its full page), `/projects`, `/blog`, `/cv` (experience, education, skills, CV download), `/funding` and `/contact` (channels and the message form). `src/lib/siteSections.ts` maps sections to paths and route IDs; `app.html` sets `data-sveltekit-preload-data="hover"`, Spotlight preloads the data of its highlighted command, and page loads avoid `parent()` (the root layout already returns `projects` without excluded repos and `pinnedRepoNames`) so a navigation never re-runs the layout load; the homepage replaces a legacy `/#section` URL with its page, and `src/hooks.server.ts` 308-redirects `/home` to `/`. `/blog/[slug]` is a post.
- Pages expose `.md`/`.txt` variants as routes (`/blog/{slug}.md`, `/privacy.txt`, …) via the `legal` and `textformat` matchers in `src/params.ts`.
- `/.well-known/**` serves `openapi.json`/`openapi.yaml`, `llms.txt`, `agent-skills`, `api-catalog`, `ard.json`; the root serves `sitemap.xml`, `robots.txt`, `atom.xml`, `llms.txt`.
- There is no `/admin` on this host and no session handling.
- `src/hooks.server.ts` — `sequence()` of: Sentry, `www.` → apex redirect, identity assets and static reverse-proxy to `PUBLIC_CDN_BASE_URL`, the `/home` redirect, CORS preflight for `/api/*`, rate limiting for `/api/*`, the CSP header for HTML (from `server/csp.ts`, including the API origin in `connect-src`), the shared error envelope, ETags for `.well-known`, and `pageDataCache` (`server/pageDataCache.ts`), which keeps the `__data.json` of the six section pages in the edge cache for 60 s under a key that includes the app version and drops tracking parameters. Read it before changing cross-cutting behavior.

### Admin (`apps/admin`)

- Pages live in the `(admin)` route group at the host root: `/` (dashboard), `/login`, `/new`. The group layout and `src/hooks.server.ts` both enforce an admin session with MFA; a passkey sign-in (`amr` method `passkey`) satisfies MFA.
- Supabase auth cookies are host-only on the admin host. Every response is `noindex` and `no-store`; `robots.txt` disallows everything; `app.html` sets `data-admin-page="true"`.
- `/api/internal/admin/**` keeps its paths; login has its own lockout (`server/loginRateLimit.ts`). Links to public pages use the author profile's `siteUrl`.
- Publishing a post enqueues a newsletter queue message (`NEWSLETTER_QUEUE` binding); without the binding it delivers in the request. Manual re-sends stay synchronous.

### Jobs (`apps/jobs`)

Consumes the newsletter queue (`newsletterQueue` in `idstead.jsonc`, default `idstead-newsletter`; retries, dead-letter queue `<queue>-dlq`, which it also consumes to report each dead-lettered message to Sentry) and runs `cleanupBlogAssets`/`cleanupAssets` daily. The same queue carries `{ kind: 'refresh-renders' }` messages (`packages/lib/src/server/renderQueue.ts`), which admin sends after saving a published post or unpublishing one; the consumer and the daily cron both run `refreshPostRenders()` (`packages/lib/src/server/postRender.ts`) re-renders published posts whose stored render is `live`, missing or from another `RENDER_VERSION`, checking the 20 newest posts and rendering at most 5 per run to stay inside the free plan's 50 external subrequests per invocation. `wrangler.jsonc` aliases `$app/env/private`/`$app/env/public` to `src/appEnv.ts`, which reads `cloudflare:workers` env, so shared server code runs unchanged.

### Data layer

- `@idstead/data` (`packages/data/src`) — the server-only data layer that pages, API handlers and jobs read through instead of querying Supabase directly. `blog.ts` holds the ports (`BlogRepository`, `CommentRepository`, `PostRenderStore`) shaped by what pages need, `subscribers.ts` the newsletter ones (`SubscriberRepository` for the subscribe, confirm and unsubscribe flows, `NewsletterStore` for claiming a post's broadcast and listing active recipients), `activity.ts` the feedback and analytics ones (`FeedbackRecorder`, `AdminNotifier`, `ActivityLog` for appending, listing and exporting the activity log, `AdminActivityStore`, which passes the admin dashboard, inbox and workspace RPC results through unchanged and also replies to comments, dismisses reports and counts subscribers (from a store built on the admin session client, because `db_subscriber_stats` checks `is_admin()` like the `db_save_*` functions do), and `AdminSettingsStore` for each admin's settings), `legal.ts` the legal page ones (`LegalPageRepository` in `Repositories`, `LegalPageWriter` built from the admin session), `adminAuthor.ts` the admin author ones (`AdminAuthorStore` for the editing snapshot with item IDs, the profile record and identity versions, `AuthorWriter` for the CV, skills, links and repository rule saves, built from the caller's own client so the database functions still check the admin session), `cvDocuments.ts` the CV document ones (`CvDocumentStore` for the CV source data, versions, snapshots, checksums, signatures and the `cv_documents` storage fallback, `OpenPgpKeyStore` for the published key), and `adminPosts.ts` the admin post ones (`AdminPostStore` for the post list, editor load and publish/pin flags, `PostOperationStore` for the idempotent save operation and its markdown and render files, `PostCleanupStore` for the queued banner and markdown cleanup; built together by `createSupabaseAdminPostStores(db)` and, being admin-only, returning post UUIDs), returning the DTOs in `@idstead/domain/blog.ts` without database IDs; `supabase/` holds their adapters, the only place those tables are queried. A post's storage location travels as an opaque `PostSource` handle, so callers never see a UUID or storage path. The service-role ports (`CommentWriter`, `ViewRecorder`, `SubscriberRepository`, `NewsletterStore`, `FeedbackRecorder`, `AdminNotifier`, returned together by `createSupabaseWriters(db)`) create comments, store reports, record views and page feedback, raise admin notifications and manage subscribers; the jobs worker and the admin post endpoints build a `NewsletterStore` alone with `createSupabaseNewsletterStore(db)` for `notifyNewPost`, and `logActivity`, `adminActivity()` and `adminWorkspace()` build `createSupabaseActivityLog(db)` and `createSupabaseAdminActivityStore(db)` from the client they authenticated with. Build them with `publicRepositories(fetch)` (`packages/lib/src/server/repositories.ts`, anon client) in SvelteKit code, `serviceData(platform)` (service-role repositories plus `writers`, or `null` without the service-role key) in the internal write endpoints, `createSupabaseRepositories(db)` in the API worker (`ApiContext.repos`), and `createSupabaseRenderStore(db)` with the service-role client for the jobs worker. It may depend on `@idstead/domain` and `@supabase/*` only, and browser code may not import it (ESLint enforces both). The public read paths for posts, comments and author data, the public comment, report and view writes, the newsletter (subscriptions and broadcasts), page feedback, contact notifications, the activity log, the admin activity, inbox and workspace analytics and admin posts (list, editor load, flags, save, content media, cleanup) and the admin author editor (snapshot, profile, import, CV entries, skills, links, repository rules), the CV documents, the OpenPGP key, legal pages, admin settings, comment replies and report dismissals, subscriber counts and the activity log go through it; and so do the data export and delete-all (`SiteDataStore` in `siteData.ts`). Admin browser code may use the Supabase client only for auth and realtime (`supabase.auth`, `channel`, `removeChannel`; ESLint enforces this), and reads and writes everything else through `/api/internal/admin/**`; the web identity asset proxy (`server/profileAssets.ts`) and the ARD index (`server/ardIndexServer.ts`) still query Supabase directly. `tests/contracts/` holds one contract suite per port group (`blogRepository`, `authorRepository`, `subscriberRepository`, `activity`, `adminPosts`, `adminAuthor`, `cvDocuments`, plus adapter tests for the legal, activity and site data stores), run against each adapter (the Supabase one through `tests/support/fakeSupabase.ts`).
- `packages/lib/src/supabase.ts` — public (anon key) Supabase client, safe for server _and_ client use.
- `packages/lib/src/server/supabaseAdmin.ts` — service-role client that bypasses RLS. **Server-only** — never import from a `.svelte` file or anything bundled for the browser.
- Author data (profile, socials, funding, contact, CV entries, skills, project repo rules, active CV document and OpenPGP key, site URL) is read through `AuthorRepository` (`@idstead/data`, `repos.author`), which returns the `@idstead/domain/author.ts` DTOs without IDs and replaces the profile's identity version UUIDs with opaque tokens. The row mappers live in `@idstead/domain/author.ts`; `packages/lib/src/author.ts` only re-exports `@idstead/domain/author.ts`, and `authorApi.ts` shapes the public API output.
- `supabase/migrations/` — schema history; production has been migrated through the MCP tool, so its recorded versions differ from file names — compare before assuming a migration is applied.
- Comment moderation uses Llama Guard 3 through the web worker's `AI` binding. If the binding or the model call fails, the request is rejected with `BLOG_COMMENT_MODERATION_UNAVAILABLE` (503). `is_approved: false` means the AI held the comment back.
- RPCs run under PostgREST's `safeupdate`: every `DELETE`/`UPDATE` in a database function needs a `WHERE` clause (`tests/safeupdate.test.ts` enforces this).
- **No hardcoded/raw content data in application code.** Author name, bio, contact info, CV entries, funding links, skills, etc. must always be fetched from Supabase — never inline a literal stand-in. This doesn't apply to files that are inherently static by convention (`.github/FUNDING.yml`, `SECURITY.md`, `package.json` metadata, etc.).

### Environments

Each app is a Worker; the [setup script](docs/001-getting-started/001-setup-script.md) deploys them once, and Workers Builds can redeploy them from the repository with the root directory `/` and commands that `cd apps/<app>` first ([Deployment](docs/006-operations/001-deployment.md) lists the commands and watch paths):

- **Production** — `main` branch, `wrangler deploy` to the custom domains in each `wrangler.jsonc`. Real Turnstile keys, `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Build triggers** watch only what each Worker bundles, with build caching on: `api` and `jobs` watch their app plus `packages/{lib,data,domain,mdrs/core}`, `web` adds `packages/{ui,mdrs/dom}`, `admin` watches all of `packages/*`, and all four watch `package.json`, `bun.lock` and `bunfig.toml`. When a Worker starts importing another package, add it to that Worker's watch paths in Workers Builds, or changes to it will not redeploy the Worker.
- **Preview** — previews need their own variables: Cloudflare's [dummy Turnstile keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), `PUBLIC_SENTRY_ENVIRONMENT=preview`. `*.workers.dev` hosts are treated as preview (noindex, robots disallow).

All apps of an instance share one Supabase project. Sentry events are tagged with `PUBLIC_SENTRY_ENVIRONMENT`, falling back to `import.meta.env.MODE` locally.

### Naming

Nothing in the repository names a particular person, domain or deployment outside the instance files: packages are `@idstead/*` and `@mdrs/*`, browser storage keys `idstead_*`, and docs and tests use `example.com` (MDRS examples `my-site.example`) and the default resource names. `tests/naming.test.ts` fails when the old personal prefix appears outside its allowlists. Personal content always comes from the database (see the content rule under Data layer).

### Markdown engine

The workspace package `@mdrs/core` (`packages/mdrs/core`) renders posts and legal pages; import it only as `@mdrs/core` or `@mdrs/core/legacy` (its `exports`), never its `src/` files (tests excepted). It is standalone: no Svelte, SvelteKit, `@idstead/*`, `#lib` or Supabase imports (ESLint enforces this). Live data (`api.v1.*` in `:::define`) comes from resolvers passed to `renderMarkdown`/`prepareMarkdownPage`; server code builds the site's with `createSupabaseMdrsResolvers(db)` (`packages/lib/src/server/mdrsData.ts`, posts through `@idstead/data`), and the admin editor preview, which renders in the browser, uses the browser-safe `createMdrsResolvers(loaders)` (`packages/lib/src/mdrsResolvers.ts`) with loaders that call the admin-only `POST /api/internal/admin/mdrs-data`. The browser side of MDRS is `@mdrs/dom` (`packages/mdrs/dom`): `enhance.ts` (`enhanceMarkdownContent`), `codeBlocks.ts`, `tabs.ts`, `charts.ts` with `MarkdownChart.svelte`, `mermaid.ts`, `headingAnchors.ts`, `CodeTabs.svelte`, the code block preferences store and `mdrs.css`, which `packages/lib/src/global.css` imports. It may depend on `@idstead/ui`, `@idstead/domain` and `@mdrs/core` only. The language is MDRS (Markdown Rich Syntax), fully documented in [docs/008-mdrs/](docs/008-mdrs/README.md); update those pages, including `003-reference/001-compatibility.md`, whenever engine behaviour changes. Links whose origin is in the `internalOrigins` render option (`siteRenderOptions(siteUrl)` in `packages/lib/src/mdrsOptions.ts` passes the site and its `www.` host; web pages use the request origin) render without the external-link icon. `renderMarkdown` always ends with `sanitizeHtml` (`packages/mdrs/core/src/sanitize.ts`, an allowlist that also covers the engine's own markup), so any new tag or attribute the engine emits must be added to that allowlist, and every class, ID and `data-` attribute it emits must use the `mdrs` namespace (`mdrs-*`, `data-mdrs-*`) with its default styling in `packages/mdrs/dom/src/mdrs.css`, never Tailwind utilities in the markup; `tests/sanitizeHtml.test.ts` fails if engine output changes under sanitizing. `tests/mdrsDocsSnapshot.test.ts` snapshots the HTML of every documented example, so any output change shows up as a snapshot diff to review. Saved posts store their rendered HTML (`{operationId}.render.json` next to the markdown, built by `packages/lib/src/server/postRender.ts`, located by `postRenderPath` from `@idstead/data`), so an intended output change also needs a bump of `RENDER_VERSION` in `packages/mdrs/core/src/version.ts`; `tests/mdrsRenderVersion.test.ts` fails until you do. Stored content is migrated between syntaxes with `scripts/migrate-markdown-syntax.ts` built on `packages/mdrs/core/src/legacy.ts`.

### Components

- `@idstead/ui` (`packages/ui/src`) — the design system, browser-safe and depending only on `@idstead/domain` (ESLint enforces this): `components/` (Button, IconButton, Dialog, ConfirmationDialog, Dropdown, ActionMenu, form fields, Toast, Tooltip, DataTable, Pagination, EmptyState, ErrorState, LoadingState, StatusBanner, StatsGrid, the shortcut badges and catalog, and `filter/` controls), `layout/` (PageMain, PageContainer, Section, FormSection), `stores/` (theme, toast, a11y, content font, reading mode, scroll, shortcuts, filter/sort), `utils/` (`cn`, focus scope, popover positioning, shortcut attachment, and `readStorage()` in `storageKeys.ts`, which reads `idstead_*` browser storage keys and moves a value from its old key in `legacyStorageKeys.ts` on first read), `shortcuts.ts` (the keyboard shortcut engine and this site's key map), `types.ts`, and `styles/` (`global.css`, `tokens.css`). Import components and stores by path (`@idstead/ui/components/Button.svelte`) or through the `@idstead/ui` barrel; ui components `@reference "../styles/global.css"`.
- `@idstead/domain` (`packages/domain/src`) — pure TypeScript with no workspace, Svelte, SvelteKit or Supabase imports: `formatters.ts`, `pluralize.ts`, `readTime.ts`, `slug.ts`, `pagination.ts`, `passwordPolicy.ts`, `fieldValidation.ts`, `nameValidator.ts`, `sanitizeInput.ts`, `safeRedirect.ts`, `xml.ts` and the domain `types.ts` (`Section`, `Project`). `bun run check` type-checks it with strict `tsc`, and the Svelte apps list it in `ssr.noExternal`.
- `apps/web/src/lib/` — components used only by the public site: `components/` (TopNav for posts and legal pages, SiteNav for the `(site)` pages, SiteMeta, ProfileCard, ProjectCard, CvEntryList, BlogPostCard, SpotlightDialog with its data and logic in `components/spotlight/` (command catalogs, help catalog, icons, pure matching), SpotlightSearch, ConsentBanner, CvDownloadMenu, LegalPageLayout, TableOfContents, …), `article/` (ArticleHeader, HelpfulBlock, PostInsights), `layout/` (FooterSection with its Navigation and Site columns, FooterSiteLink and `footerLinks.ts`, FooterLegalRow for the error page) and their stores and helpers. Import them as `#app/...` (each Svelte app's `package.json` maps `#app/*` to `./src/lib/*`; SvelteKit 3 has no `$lib`).
- `apps/admin/src/lib/` — admin-only code, imported as `#app/...`: `components/admin/` (PostEditor, AdminHome, AccountSettings, activity and chart components), the image upload components and processing pipeline (`process*.ts`, `workers/`), admin stores, session timeout, post save client and `mdrsPreview.ts`.
- `bun tooling/lib-usage.ts` shows which app reaches each remaining lib file; move a file into an app once only that app uses it and no shared lib file imports it.
- `packages/lib/src/components/` — the components both apps share (CommentThread, BrandIcon).
- `@mdrs/editor` (`packages/mdrs/editor/src`) — the Markdown editor. Import it only as `import { MarkdownEditor } from '@mdrs/editor'`; the shell composes `EditorViewBar` (tabs, settings, the optional `onImport` file button), `EditorToolbar`, `EditorCodeArea`, `EditorPreview` and `EditorStatusBar`, with pure helpers in `textEdits.ts`, `highlight.ts` and `preferences.svelte.ts`. It never imports Supabase: callers pass `render` (the admin uses `renderMdrsPreview` from `apps/admin/src/lib/mdrsPreview.ts`, which fetches live data from `/api/internal/admin/mdrs-data` and caches it for a minute) and the upload and import handlers.
- The page-structure primitives (PageMain, PageContainer, Section, FormSection) are in `@idstead/ui/layout/`. `PageMain` is the `<main id="main">` shell that clears the fixed `TopNav`/`SiteNav` (`variant="article"` and `reading` for posts and legal pages, `variant="site"` for the `(site)` pages, whose content starts level with the floating tool bar wherever the `toolbar-gutter` variant applies: at least 80rem wide and a font scale of 110% or less, so the tool bar can never cover content); use it instead of repeating the offsets. `Input` with `type="search"` draws a leading Lucide `Search` icon unless it has its own leading icon or slot.
- `packages/lib/src/article/ArticleMeta.svelte` — post metadata line shared by the web post page and the admin post list.
- Styling: Tailwind CSS 4 (via `@tailwindcss/vite`, no separate config file) plus `tokens.css` and `global.css` in `@idstead/ui/styles/` — component- and page-specific styling lives in each component/page's own `<style>` block or inline Tailwind classes.
- **Every page must reuse the existing shared components/layout primitives consistently** — never build a page-local one-off replacement for something that already exists. Run the `ui-consistency-check` skill (or the `ui-consistency-reviewer` agent) after touching any page or component to catch drift.

### Agent/skills tooling

`.agents/` and `agent/skills/` hold Supabase and security-audit skill references used by AI coding agents working in this repo (Postgres best practices, security audit checklists) — not part of the application runtime.

### Svelte MCP tooling

Claude Code can use the Svelte MCP server, which provides comprehensive Svelte 5 and SvelteKit documentation. Follow this workflow when working on Svelte or SvelteKit topics:

- Use `list-sections` first to discover available documentation sections. It returns titles, use cases, and paths.
- After `list-sections`, analyze the returned sections, especially `use_cases`, and use `get-documentation` to retrieve every section relevant to the task. The tool accepts one or multiple sections.
- Use `svelte-autofixer` whenever writing Svelte code, before presenting it to the user. Continue calling it until it returns no issues or suggestions.
- After completing code, ask the user whether they want a Svelte Playground link. Call `playground-link` only after the user confirms, and never call it when the code was written to project files.

## Code style

Enforced by `prettier.config.ts` + `eslint.config.ts` — run `bun run fmt` before committing. Svelte 5 runes syntax (`$state`, `$derived`, etc.) is used throughout — this is not Svelte 4/Options API.

- **No comments in code.** Don't add comments describing what code does or why, even for non-obvious logic — prefer clear naming/structure instead.
- **Prefer Tailwind utility classes over hand-written CSS** wherever Tailwind can express it. Only drop into a `<style>` block for things Tailwind genuinely can't do (e.g. complex selectors, animations Tailwind doesn't cover).
- **Always write security-aware code.** Validate/sanitize untrusted input at every boundary, avoid injection/XSS/auth-bypass-shaped patterns, and default to the same scrutiny the `security-audit` skill and `security-reviewer` agent apply — don't wait to be asked to "think about security" on a given change.

## Git workflow

This repo uses **git-flow-next** (classic preset — https://git-flow.sh/), initialized via `git-flow init --preset=classic --defaults --main main`. Config lives in local `.git/config` (`gitflow.*` keys), not committed — re-run that command on a fresh clone.

- `main` — production/release only. Never commit directly; only `release/*` and `hotfix/*` branches merge into it (and get tagged). Deploys every Worker to **Production** (see [Environments](#environments)).
- `develop` — integration branch. `feature/*` and `bugfix/*` branch from and merge back into it. Builds Worker **Previews**.
- `feature/<name>`, `bugfix/<name>` — parent `develop`. `git-flow feature start <name>` / `git-flow feature finish <name>`.
- `release/<name>`, `hotfix/<name>` — parent `main`, started from `develop`/`main` respectively, merge into `main`, tagged on finish.

Use `git-flow overview` to see current branch structure and `git-flow <topic> list` to see active topic branches.

**Always sign commits with `-s`/`--signoff`** (`git commit -s ...`, including on `git-flow` `feature`/`release`/`hotfix` finish operations).

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint (`commitlint.config.ts`, extending `@commitlint/config-conventional`); there is no CI gate, so validate locally. Read the resolved rules with `bunx commitlint --print-config json`; validate a candidate message before committing with `printf '%s' "<message>" | bunx commitlint`. The `.claude/skills/committing-with-commitlint` skill covers this in detail — follow it when writing a commit message.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## This instance

This checkout is also the owner's own instance, **fkp.my.id**. Only these places may name it: `idstead.jsonc` (site `fkp.my.id`, the default Worker and queue names, and the bucket `static`), the rendered `apps/*/wrangler.jsonc`, the live-example link in `README.md`, the security contact in `SECURITY.md`, and this section of `CLAUDE.md` and `AGENTS.md`.

- **Environment variables** come from Phase (app `www`, environments Development and Production; `.claude/rules/phase.md` has the rules). Run commands as `phase run --env dev|prod -- <command>`; Production Worker secrets are synced from the Phase folders `/workers/<app>`, so never edit them in the Cloudflare dashboard.
- **Dev servers in parallel:** `run dev [dev.web ...]` through the `run` command runner; targets live in `run.conf` (`run --list`).
- **Deploys:** each Worker is connected to Workers Builds on `main` only; previews are not connected, so `develop` and PRs deploy nothing.
- **Database:** production has been migrated partly through the Supabase MCP tool, so recorded migration versions differ from the file names.
