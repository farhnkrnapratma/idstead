# Repository Guidelines

This file provides guidance to Codex CLI, Claude Code, Antigravity, and other AI coding agents when working with code in this repository.

## Project

Personal website/blog for Farhan Kurnia Pratama (fkp.my.id) — SvelteKit 5 + TypeScript + Tailwind CSS 4, backed by Supabase (Postgres + RLS), deployed to Cloudflare Pages via `@sveltejs/adapter-cloudflare`. Also publishes a public read-only REST API under `/api/v1`.

## Commands

Package manager is **bun** — never use npm/npx/yarn/pnpm in this repo (`bun.lock` is the lockfile; use `bun`/`bunx` for everything, including one-off tool invocations).

```sh
bun install           # install deps
bun run dev [--host]  # start Vite dev server (mode: development)
bun run dev:preview   # start Vite dev server against Preview-tier config (mode: preview)
bun run build         # production build -> .svelte-kit/cloudflare (mode: production)
bun run build:preview # build against Preview-tier config (mode: preview)
bun run preview       # preview the production build
bun run test          # Bun regression tests with isolated database fixtures
bun run check         # svelte-kit sync + svelte-check (type checking)
bun run check:watch   # same, in watch mode
bun run lint          # prettier --write . && eslint .
bun run lint:fix      # eslint . --fix
bun run fmt           # prettier --write .
bun run fmt:check     # prettier --check .
```

`bun run test` runs permanent Bun regression tests in `tests/`, including isolated PGlite database tests. Run tests, `bun run check`, and `bun run lint` after non-trivial changes; CI also builds the Cloudflare application. The optional PostgreSQL concurrency suite requires its own disposable Docker container, as documented in README. Keep manual browser harnesses and session reports in ignored local archives, not application source. Build plugins and Git hooks live in `tooling/`; `scripts/` retains operational migration and cleanup commands until Production cutover is complete.

Requires a `.env` (copy from `.env.development.example` or `.env.production.example`) with at least `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the dev server to start. Other vars: Cloudflare R2 (CV file storage), Sentry, Turnstile (bot protection), `IP_SALT` (salts the `ip_hash` column on `db_activity_log`; the admin logs table and its exports also show the raw client IP), `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS), `CLOUDFLARE_API_TOKEN` (wrangler CLI auth — needed for the `AI` binding's `remote: true` mode in `wrangler.jsonc` to reach Cloudflare; without it comment moderation returns `BLOG_COMMENT_MODERATION_UNAVAILABLE`). Tier templates are `.env.production.example` / `.env.development.example` — copy to `.env.production` / `.env.development` (and optionally `.env`) for the tier you're targeting locally (see [Environments](#environments) below).

## Architecture

### Routing (`src/routes`)

- `/` is a single-page app — sections (`blog`, `projects`, `contact`, `cv`, `funding`, `home`) are anchors (`/#section`); `src/hooks.server.ts` 307-redirects bare `/blog`, `/projects`, etc. to their hash-anchor form.
- `/blog/[slug]` — individual blog post pages.
- `/admin`, `/admin/login`, `/admin/new` — admin UI for authoring blog posts (backed by Supabase auth, not a custom session system).
- `/api/v1/**` — the public REST API (see below).
- `/.well-known/**` — serves canonical `openapi.json`/`openapi.yaml`, `llms.txt`, `agent-skills`, `api-catalog`.
- Root also serves `sitemap.xml`, `robots.txt`, `atom.xml`, `llms.txt` as `+server.ts` endpoints.

### Public API (`src/routes/api/v1`)

Full endpoint reference and error-code table: [src/routes/api/v1/README.md](src/routes/api/v1/README.md) — this is also served live at `GET /api/v1`. Read it before adding/changing any API route. Key conventions to preserve when touching API code:

- **Error envelope**: route handlers return a flat `{code, message, details?}` body via `apiError()` (`src/lib/server/apiError.ts`); `src/hooks.server.ts` is the single place that wraps this into the public `{error: {...}}` shape. Never hand-roll error JSON in a route — always go through `apiError`.
- **Error codes** are stable and per-endpoint (e.g. `BLOG_POST_NOT_FOUND`, `BLOG_COMMENT_TURNSTILE_FAILED`) — add new codes to both the handler and the README table, don't reuse generic ones.
- **Versioning**: breaking changes ship under a new `/api/v2/`, never in place under `/api/v1`.
- **`/api/v1` is strictly read-only (`GET` only)** — no route under it may export a mutating method (`POST`/`PUT`/`PATCH`/`DELETE`). Anything that needs to write data (comment submission, view counting, admin login/CV upload/delete) lives under `/api/internal/**` instead — unversioned, undocumented, first-party-only (no `Access-Control-Allow-Origin` wildcard, gated by `isSameOriginRequest()` from `src/lib/server/sameOrigin.ts` where there's no other auth). Never add a mutating handler under `/api/v1`.
- **CORS + rate limiting** are handled centrally in `src/hooks.server.ts` (60 req/min/IP via Cloudflare's `API_RATE_LIMITER` binding, with an in-memory-per-isolate fallback for local dev) — `/api/internal/admin/*` is exempted from the general limiter but has its own lockout (`src/lib/server/loginRateLimit.ts`, 5 failed attempts / 15 min).
- **Markdown responses**: `?format=md` / `Accept: text/markdown` is supported only on `/api/v1/blog`, `/api/v1/blog/{id_or_slug}`, and `/api/v1/author` — don't assume it works elsewhere.
- Keep `src/lib/openapi.ts` and `/.well-known/openapi.{json,yaml}` in sync with any route/schema changes.

### Data layer

- `src/lib/supabase.ts` — public (anon key) Supabase client, safe for server _and_ client use.
- `src/lib/server/supabaseAdmin.ts` — service-role client that bypasses RLS. **Server-only** — never import from a `.svelte` file or anything bundled for the browser. Used where RLS deliberately blocks the public role (e.g. comment inserts must go through Turnstile + AI moderation first, not a direct anon-key insert).
- `src/lib/authorApi.ts` / `src/lib/author.ts` — fetch/shape the author profile (CV, funding, contact, skills, socials) consumed by both the root layout and `/api/v1/author*`.
- `src/lib/supabaseFunctions.ts` — Supabase Edge Function calls from the app.
- `supabase/functions/` — Supabase Edge Functions (`admin`, `admin-cv-upload`, `admin-cv-delete`) deployed separately from the SvelteKit app.
- Comment moderation: submissions are checked by Llama Guard 3 (via the Cloudflare `AI` binding declared in `wrangler.jsonc`). If that binding is unavailable or the model call fails, the request is rejected with `BLOG_COMMENT_MODERATION_UNAVAILABLE` (503) — there is no heuristic fallback. `is_approved: false` means the AI held the comment back, not published.
- **No hardcoded/raw content data in application code.** Author name, bio, contact info, CV entries, funding links, skills, etc. must always be fetched from Supabase via `author.ts`/`authorApi.ts` — never inline a literal value (e.g. the author's name or bio) directly in a component or route as a stand-in for real data. This doesn't apply to files that are inherently static by format/platform convention (`.github/FUNDING.yml`, `SECURITY.md`, `package.json` metadata, etc.) — those aren't rendered app content.

### Environments

Two Cloudflare Pages tiers, each with its own dashboard-configured environment variable set (Cloudflare Pages always builds with the single `bun run build` command for both tiers — there's no per-environment build command — so the variable set is what differentiates a deployment, never a committed `.env.*` file, which is for local dev only):

- **Production** — `main` branch, deploys to `fkp.my.id`. Real Turnstile keys, `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Preview** — `develop` branch (and PRs), deploys to a `*.pages.dev` URL. Cloudflare's [dummy Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) instead of real ones (preview URLs aren't a verified Turnstile domain), `PUBLIC_SENTRY_ENVIRONMENT=preview`.

Both tiers share the same Supabase project and `wrangler.jsonc` bindings (`AI`, `API_RATE_LIMITER`) — no per-tier split there. `src/hooks.server.ts` and `src/hooks.client.ts` tag Sentry events with `PUBLIC_SENTRY_ENVIRONMENT`, falling back to `import.meta.env.MODE` when that var is unset (local dev), so `production`/`preview`/`development` events never mix in Sentry. Canonical templates are `.env.production.example` / `.env.development.example` (full variable sets per tier, including Turnstile and `PUBLIC_SENTRY_ENVIRONMENT`). `bun run dev` (Vite mode `development`) automatically layers `.env` → `.env.development`, while `bun run build` layers `.env` → `.env.production`.

### `src/hooks.server.ts`

Single `sequence()`-composed `Handle` doing, in order: Sentry init/handle, `www.` → apex redirect, favicon/static-asset reverse-proxies to `PUBLIC_CDN_BASE_URL`, section-path → hash-anchor redirects, CORS preflight handling for `/api/*`, then rate limiting for non-admin API routes. Read this file before changing any cross-cutting request behavior (redirects, CORS, rate limits) — don't duplicate this logic in individual routes.

### Components (`src/lib`)

- `src/lib/components/` — flat directory of reusable UI primitives (Button, Dialog family, form fields, Toast, DataTable, Pagination, etc.) plus one `filter/` subfolder.
- `src/lib/layout/` — page-structure components (AppShell, PageContainer, Section, FormSection, etc.), separate from generic UI components.
- `src/lib/article/` — blog-post-specific rendering (ArticleHeader, ArticleMeta, HelpfulBlock).
- `src/lib/stores/` — Svelte 5 runes-based stores (`.svelte.ts` files): theme, toast, consent, filter/sort state.
- Styling: Tailwind CSS 4 (via `@tailwindcss/vite`, no separate config file) plus `src/lib/tokens.css` for design tokens and `src/routes/global.css` for the irreducible global reset/Tailwind entry point — component- and page-specific styling lives in each component/page's own `<style>` block or inline Tailwind classes instead.
- **Every page must reuse the existing shared components/layout primitives consistently** (`src/lib/components/`, `src/lib/layout/`, `src/lib/article/`) — never build a page-local one-off replacement for something that already exists (e.g. a custom footer instead of `src/lib/layout/FooterSection.svelte`). Run the `ui-consistency-check` skill (or the `ui-consistency-reviewer` agent) after touching any page or component to catch drift.

### Agent/skills tooling

`.agents/` and `agent/skills/` hold Supabase and security-audit skill references used by AI coding agents working in this repo (Postgres best practices, security audit checklists) — not part of the application runtime.

### Svelte MCP tooling

The agent can use the Svelte MCP server, which provides comprehensive Svelte 5 and SvelteKit documentation. Follow this workflow when working on Svelte or SvelteKit topics:

- Use `list-sections` first to discover available documentation sections. It returns titles, use cases, and paths.
- After `list-sections`, analyze the returned sections, especially `use_cases`, and use `get-documentation` to retrieve every section relevant to the task. The tool accepts one or multiple sections.
- Use `svelte-autofixer` whenever writing Svelte code, before presenting it to the user. Continue calling it until it returns no issues or suggestions.
- After completing code, ask the user whether they want a Svelte Playground link. Call `playground-link` only after the user confirms, and never call it when the code was written to project files.

## Code style

Enforced by `prettier.config.ts` + `eslint.config.ts` — run `bun run fmt` before committing. Notable non-defaults: no semicolons, single quotes, no trailing commas, no bracket spacing (`{foo}` not `{ foo }`), `arrowParens: 'avoid'`, 2-space indent. Svelte 5 runes syntax (`$state`, `$derived`, etc.) is used throughout — this is not Svelte 4/Options API.

- **No comments in code.** Don't add comments describing what code does or why, even for non-obvious logic — prefer clear naming/structure instead.
- **Prefer Tailwind utility classes over hand-written CSS** wherever Tailwind can express it. Only drop into a `<style>` block for things Tailwind genuinely can't do (e.g. complex selectors, animations Tailwind doesn't cover).
- **Always write security-aware code.** Validate/sanitize untrusted input at every boundary, avoid injection/XSS/auth-bypass-shaped patterns, and default to the same scrutiny the `security-audit` skill and `security-reviewer` agent apply — don't wait to be asked to "think about security" on a given change.

## Git workflow

This repo uses **git-flow-next** (classic preset — https://git-flow.sh/), initialized via `git-flow init --preset=classic --defaults --main main`. Config lives in local `.git/config` (`gitflow.*` keys), not committed — re-run that command on a fresh clone.

- `main` — production/release only. Never commit directly; only `release/*` and `hotfix/*` branches merge into it (and get tagged). Deploys to Cloudflare Pages **Production** (see [Environments](#environments)).
- `develop` — integration branch. `feature/*` and `bugfix/*` branch from and merge back into it. Deploys to Cloudflare Pages **Preview**.
- `feature/<name>`, `bugfix/<name>` — parent `develop`. `git-flow feature start <name>` / `git-flow feature finish <name>`.
- `release/<name>`, `hotfix/<name>` — parent `main`, started from `develop`/`main` respectively, merge into `main`, tagged on finish.

Use `git-flow overview` to see current branch structure and `git-flow <topic> list` to see active topic branches.

**Always sign commits with `-s`/`--signoff`** (`git commit -s ...`, including on `git-flow` `feature`/`release`/`hotfix` finish operations).

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint (`commitlint.config.ts`, extending `@commitlint/config-conventional`) and gated in CI on every PR. Read the resolved rules with `bunx commitlint --print-config json`; validate a candidate message before committing with `printf '%s' "<message>" | bunx commitlint`. The `.claude/skills/committing-with-commitlint` skill covers this in detail — follow it when writing a commit message.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
