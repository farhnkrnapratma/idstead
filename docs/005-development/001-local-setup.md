# Local Setup

## Prerequisites

- [Bun](https://bun.com/). Bun is the only package manager; never use npm, npx, yarn or pnpm here. Use `bun` and `bunx`.
- Optional: [TruffleHog](https://github.com/trufflesecurity/trufflehog#installation). The pre-commit secret scan uses it and is skipped if it is missing.

## Install

```sh
git clone <repository-url> idstead
cd idstead
bun install
```

`bun install` runs the root `prepare` script, which runs each app's `prepare` (SvelteKit sync) and then installs the Git pre-commit hook from `tooling/git-hooks/` (see [scripts-and-tooling.md](003-scripts-and-tooling.md)).

## Environment variables

Copy `.env.example` to `.env` in the repository root and fill in the values. Every app reads that one file: the Vite configs point `envDir` at the root, and Bun loads it for tests and scripts. Then start the dev servers:

```sh
bun run dev                              # public site (Vite)
bun run dev:admin                        # admin portal, http://localhost:5174
bun run --filter @idstead/api dev        # API worker, http://localhost:8787
bun run --filter @idstead/jobs dev       # jobs worker, http://localhost:8788 (--test-scheduled)
```

- At minimum, `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be set, or the dev servers fail at start-up. `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL` are required too.
- For what each variable does and which app reads it, see [environment.md](../002-configuration/002-environment.md).
- With a secret manager instead of a `.env` file, start each command through it, for example `phase run --env dev -- bun run dev` with [Phase](https://phase.dev) ([environment.md](../002-configuration/002-environment.md#using-a-secret-manager)).

### Local tips

- **Local API:** to point the site at a locally running API, set `PUBLIC_API_BASE_URL=http://localhost:8787` for the web process.
- **Workers AI:** the `AI` binding is `remote: true`, so local dev calls real Workers AI. It needs `CLOUDFLARE_API_TOKEN` for wrangler auth. Comment moderation and ARD search do not work offline.
- **Admin Turnstile:** Development uses Cloudflare's dummy Turnstile keys, so the login route's own check passes locally. All environments share one Supabase project, so once Supabase Auth CAPTCHA protection is enabled with the production secret, dummy tokens fail Supabase's check and local password and passkey sign-in stop working. Use a real Turnstile widget that allows `localhost` for development, or sign in on production.

## Everyday commands

```sh
bun run check        # svelte-check (web, admin) + tsc (api, jobs, mdrs)
bun run lint         # prettier --write . && eslint .
bun run fmt:check    # prettier --check .
bun run test         # bun test tests
bun run build        # build every app (SvelteKit builds + wrangler dry-run bundles)
```

There is no CI pipeline. These local runs are the only gate before Workers Builds deploys from `main` ([deployment](../006-operations/001-deployment.md)). Run `test`, `check` and `lint` after any non-trivial change.

## Monorepo layout

| Path | Deploys as | Notes |
| --- | --- | --- |
| `apps/web` | `idstead-web` on `example.com` | SvelteKit public site |
| `apps/admin` | `idstead-admin` on `admin.example.com` | SvelteKit admin portal (port 5174) |
| `apps/api` | `idstead-api` on `api.example.com` | Hono public API (port 8787) |
| `apps/jobs` | `idstead-jobs` | Queue consumer + cron (port 8788) |
| `packages/lib` | – | `@idstead/lib`, imported everywhere as `#lib/...` |
| `tests/` | – | Bun tests ([testing.md](002-testing.md)) |
| `scripts/`, `tooling/` | – | [scripts-and-tooling.md](003-scripts-and-tooling.md) |
| `supabase/` | – | migrations |
| `templates/` | – | starter content for a new site |

Lib code must type-check in both web and admin, so don't use app-specific typed routes inside `packages/lib`.
