# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It holds the rules most tasks need; the details of each area live in path-scoped rules under `.claude/rules/`, which load when Claude opens a matching file (see [Where details live](#where-details-live)).

## Project

**Idstead**: a self-hostable personal site and identity home (profile, blog, projects, resume, funding and contact pages, an admin portal and a public API) — SvelteKit 5 + TypeScript + Tailwind CSS 4, backed by Cloudflare D1 and R2 with Cloudflare Access in front of the admin, deployed as Cloudflare Workers. Anyone can run an instance with their own data; the owner's instance is described under [This instance](#this-instance). Worker names and hosts below are the defaults from `idstead.example.jsonc` for the site `example.com`:

| Workspace | Worker | Host | Role |
| --- | --- | --- | --- |
| `apps/web` | `idstead-web` | `example.com` (+ `www.`) | Public site: homepage, `/blog`, posts, legal pages, feeds, `.well-known`, first-party `/api/internal/**` and `/api/ard/**`. |
| `apps/admin` | `idstead-admin` | `admin.example.com` | Admin portal at the host root plus `/api/internal/admin/**`. |
| `apps/api` | `idstead-api` | `api.example.com/v1` | Public read-only REST API (Hono). |
| `apps/jobs` | `idstead-jobs` | none | Queue consumer (`idstead-newsletter`), daily cron cleanups and post render refreshes. |
| `packages/lib` | — | — | `@idstead/lib`: site feature components, data access, server helpers, API handlers. |
| `packages/ui` | — | — | `@idstead/ui`: the design system: tokens, global styles, UI primitives, layout primitives, UI stores and the keyboard shortcut system. |
| `packages/domain` | — | — | `@idstead/domain`: pure, framework-free helpers and types (formatters, read time, slugs, pagination, validation, sanitizers, public post DTOs). |
| `packages/data` | — | — | `@idstead/data`: the server-only data layer: repository ports, their D1 adapters and the read cache. |
| `packages/mdrs/core` | — | — | `@mdrs/core`: the standalone MDRS engine (render, `:::define`, frontmatter, sanitizer). |
| `packages/mdrs/dom` | — | — | `@mdrs/dom`: the browser side of MDRS (code blocks, tabs, charts, Mermaid, heading anchors) and `mdrs.css`. |
| `packages/mdrs/editor` | — | — | `@mdrs/editor`: the Markdown/MDRS editor (`MarkdownEditor`). |

## Commands

Package manager is **bun** — never use npm/npx/yarn/pnpm in this repo (`bun.lock` is the lockfile; use `bun`/`bunx` for everything, including one-off tool invocations).

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
bun run check            # svelte-check for web/admin, tsc for api/jobs/mdrs and for tests/tooling (root tsconfig.json)
bun run lint             # prettier --write . && eslint . && bun run lint:deprecated
bun run lint:deprecated  # typed ESLint pass (eslint.deprecated.config.ts) that fails on any @deprecated API, icon or option
bun run fmt / fmt:check  # prettier
```

Run tests, `bun run check` and `bun run lint` after non-trivial changes; there is no CI pipeline, so these local runs are the only gate before Workers Builds deploys. Repository changes must keep the suites in `tests/contracts/` passing. `tests/` stays at the repository root and imports from `packages/*/src` and `apps/*/src`.

Where the instance runs (domains, Worker, bucket and queue names, cron) lives in `idstead.jsonc`: edit it and run `bun run configure` instead of editing the generated `apps/*/wrangler.jsonc`. Env files stay at the repository root and `.env.example` lists every key once; this instance reads them from Phase (see [This instance](#this-instance)).

## Rules for every task

- **No hardcoded/raw content data in application code.** Author name, bio, contact info, resume entries, funding links, skills, etc. must always be fetched from the database — never inline a literal stand-in. This doesn't apply to files that are inherently static by convention (`.github/FUNDING.yml`, `SECURITY.md`, `package.json` metadata, etc.).
- **No database IDs in public output.** Never return UUIDs or `*_id` columns from the API, page data, feeds or banner URLs; posts and comments are identified by their `public_id`.
- **Writes stay first-party.** The API worker is read-only (`GET`/`HEAD`/`OPTIONS`); anything that writes lives under `/api/internal/**` on web or admin. D1 has no row-level security, so check the caller before using `dataStores().service`: public writes are same-origin and Turnstile-gated, admin endpoints verify the admin first.
- **Naming.** Nothing in the repository names a particular person, domain or deployment outside the instance files: packages are `@idstead/*` and `@mdrs/*`, browser storage keys `idstead_*`, and docs and tests use `example.com` (MDRS examples `my-site.example`) and the default resource names. `tests/naming.test.ts` fails when the old personal prefix appears outside its allowlists.
- **No legacy.** When something is replaced, remove the old version in the same change: no aliases, fallbacks, compatibility shims, old-URL redirects or deprecated paths ([`.claude/rules/no-legacy.md`](.claude/rules/no-legacy.md)).
- **No comments in code.** Don't add comments describing what code does or why, even for non-obvious logic — prefer clear naming/structure instead.
- **Prefer Tailwind utility classes over hand-written CSS** wherever Tailwind can express it, and reuse the shared components and layout primitives instead of page-local one-offs; run the `ui-consistency-check` skill after touching a page or component.
- **Always write security-aware code.** Validate/sanitize untrusted input at every boundary, avoid injection/XSS/auth-bypass-shaped patterns, and default to the same scrutiny the `security-audit` skill and `security-reviewer` agent apply.
- Formatting is enforced by `prettier.config.ts` + `eslint.config.ts` (`bun run fmt`). Svelte 5 runes syntax (`$state`, `$derived`, etc.) is used throughout.
- This repository is set up for Claude Code only. Do not add configuration for other coding agents (`AGENTS.md`, `.agents/`, `.cursor/`, `.codex/` and the like).

## Where details live

Each rule file loads when Claude reads or edits a file under the listed paths. Read the matching file before working in an area if it has not loaded yet.

| Rule file | Loads for | Covers |
| --- | --- | --- |
| [`.claude/rules/lib.md`](.claude/rules/lib.md) | `packages/lib/**` | `#lib` imports, shared components, `global.css`, server helpers |
| [`.claude/rules/api.md`](.claude/rules/api.md) | `apps/api/**`, `packages/lib/src/server/api/**`, `openapi.ts` | API conventions: error envelope and codes, versioning, parameters, representations, OpenAPI sync |
| [`.claude/rules/web.md`](.claude/rules/web.md) | `apps/web/**` | Site sections and routes, text variants, `.well-known`, `hooks.server.ts` order, page data cache |
| [`.claude/rules/admin.md`](.claude/rules/admin.md) | `apps/admin/**` | Cloudflare Access sign-in, `noindex`, newsletter queue on publish |
| [`.claude/rules/jobs.md`](.claude/rules/jobs.md) | `apps/jobs/**`, render and newsletter queues | Queue consumer, crons, render refresh limits, env aliasing |
| [`.claude/rules/data-layer.md`](.claude/rules/data-layer.md) | `packages/data/**`, `data.ts`, `repositories.ts`, `tests/contracts/**` | Ports and D1 adapters, `dataStores()`, read cache, contract suites, migrations, moderation |
| [`.claude/rules/deployment.md`](.claude/rules/deployment.md) | `idstead*.jsonc`, `apps/*/wrangler*.jsonc`, env files, `tooling/**` | Tooling layout, every environment variable, Worker secrets, production, build triggers, previews |
| [`.claude/rules/mdrs.md`](.claude/rules/mdrs.md) | `packages/mdrs/**`, `docs/008-mdrs/**` | Engine boundaries, resolvers, sanitizer and `mdrs-*` namespace, snapshots, `RENDER_VERSION` |
| [`.claude/rules/components.md`](.claude/rules/components.md) | `**/*.svelte`, `**/*.css`, `packages/ui/**`, `packages/domain/**` | Design system contents, app-only components, layout primitives, color tokens, Svelte MCP workflow |
| [`.claude/rules/agent-tooling.md`](.claude/rules/agent-tooling.md) | `.claude/**`, `.mcp.json` | Skills, review agents, hooks and MCP servers |

Architecture and operations docs for people are in [docs/](docs/README.md); the public API reference is [apps/api/src/README.md](apps/api/src/README.md).

## Git workflow

This repo uses **git-flow-next** (classic preset — https://git-flow.sh/), initialized via `git-flow init --preset=classic --defaults --main main`. Config lives in local `.git/config` (`gitflow.*` keys), not committed — re-run that command on a fresh clone.

- `main` — production/release only. Never commit directly; only `release/*` and `hotfix/*` branches merge into it (and get tagged). Deploys every Worker to Production.
- `develop` — integration branch. `feature/*` and `bugfix/*` branch from and merge back into it.
- `feature/<name>`, `bugfix/<name>` — parent `develop`. `git-flow feature start <name>` / `git-flow feature finish <name>`.
- `release/<name>`, `hotfix/<name>` — parent `main`, started from `develop`/`main` respectively, merge into `main`, tagged on finish.

**Always sign commits with `-s`/`--signoff`** (`git commit -s ...`, including on `git-flow` `feature`/`release`/`hotfix` finish operations).

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint (`commitlint.config.ts`); validate a candidate message with `printf '%s' "<message>" | bunx commitlint`. The `.claude/skills/committing-with-commitlint` skill covers this in detail — follow it when writing a commit message.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## This instance

This checkout is also the owner's own instance, **fkp.my.id**. Only these places may name it: `idstead.jsonc` (site `fkp.my.id`, the default Worker and queue names, and the bucket `static`), the rendered `apps/*/wrangler.jsonc`, the live-example link in `README.md`, the security contact in `SECURITY.md`, and this section of `CLAUDE.md`.

- **Environment variables** come from Phase (app `idstead`, environments `development` and `production`; `.claude/rules/phase.md` has the rules). Run commands as `phase run --env dev|prod -- <command>`; Production Worker secrets are synced from the Phase folders `/workers/<app>`, so never edit them in the Cloudflare dashboard.
- **Dev servers in parallel:** `run dev [dev.web ...]` through the `run` command runner; targets live in `run.conf` (`run --list`).
- **Deploys:** each Worker is connected to Workers Builds on `main` only; previews are not connected, so `develop` and PRs deploy nothing.
- **Database:** production runs on the D1 database `idstead` since 2026-10-23 (`DATA_CACHE=1`).

<!-- fallow:agent-install v1 claude-import:start -->

@AGENTS.md
<!-- fallow:agent-install v1 claude-import:end -->
