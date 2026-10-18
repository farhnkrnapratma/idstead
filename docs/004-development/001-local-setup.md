# Local Setup

## Prerequisites

- [Bun](https://bun.com/). Bun is the only package manager; never use npm, npx, yarn or pnpm here. Use `bun` and `bunx`.
- The [Phase](https://phase.dev) CLI, authenticated (`phase auth`), for environment variables.
- Optional: [TruffleHog](https://github.com/trufflesecurity/trufflehog#installation). The pre-commit secret scan uses it and is skipped if it is missing.

## Install

```sh
git clone <repository-url> www
cd www
bun install
```

`bun install` runs the root `prepare` script, which runs each app's `prepare` (SvelteKit sync) and then installs the Git pre-commit hook from `tooling/git-hooks/` (see [scripts-and-tooling.md](004-scripts-and-tooling.md)).

## Environment variables

Variables come from Phase. The repo is linked through `.phase.json`: app `www`, default environment `Development`. Start every process through `phase run` and choose the environment explicitly:

```sh
phase run --env dev bun run dev                       # public site (Vite)
phase run --env dev bun run dev:admin                 # admin portal, http://localhost:5174
phase run --env dev bun run --filter @fkp/api dev     # API worker, http://localhost:8787
phase run --env dev bun run --filter @fkp/jobs dev    # jobs worker, http://localhost:8788 (--test-scheduled)
```

- `--env` matches by prefix: `dev` → Development, `prod` → Production. Use `dev` unless you need production values.
- To see which variables exist, run `phase secrets list`. Do not print their values.
- At minimum, `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be set, or the dev servers fail at start-up.
- For what each variable does and which app reads it, see [environment.md](002-environment.md).

If you have no access to the Phase project, copy `.env.example` to `.env` and fill in the values (see the README's "Configure Environment Variables" section).

### Local tips

- **Local API:** to point the site at a locally running API, set `PUBLIC_API_BASE_URL=http://localhost:8787` for the web process.
- **Workers AI:** the `AI` binding is `remote: true`, so local dev calls real Workers AI. It needs `CLOUDFLARE_API_TOKEN` for wrangler auth. Comment moderation and ARD search do not work offline.
- **Admin Turnstile:** Development uses Cloudflare's dummy Turnstile keys, so the login route's own check passes locally. All environments share one Supabase project, so once Supabase Auth CAPTCHA protection is enabled with the production secret, dummy tokens fail Supabase's check and local password and passkey sign-in stop working. Use a real Turnstile widget that allows `localhost` for development, or sign in on production.

## Everyday commands

```sh
bun run check        # svelte-check (web, admin) + tsc (api, jobs, mdrs)
bun run lint         # prettier --write . && eslint .
bun run fmt:check    # prettier --check .
phase run --env dev bun run test   # bun test tests
phase run --env prod bun run build # build every app (SvelteKit builds + wrangler dry-run bundles)
```

There is no CI. These local runs are the only gate before Workers Builds deploys from `main` ([deployment](../005-operations/001-deployment.md)). Run `test`, `check` and `lint` after any non-trivial change.

## Monorepo layout

| Path | Deploys as | Notes |
| --- | --- | --- |
| `apps/web` | `fkp-web` on `fkp.my.id` | SvelteKit public site |
| `apps/admin` | `fkp-admin` on `admin.fkp.my.id` | SvelteKit admin portal (port 5174) |
| `apps/api` | `fkp-api` on `api.fkp.my.id` | Hono public API (port 8787) |
| `apps/jobs` | `fkp-jobs` | Queue consumer + cron (port 8788) |
| `packages/lib` | – | `@fkp/lib`, imported everywhere as `#lib/...` |
| `tests/` | – | Bun tests ([testing.md](003-testing.md)) |
| `scripts/`, `tooling/` | – | [scripts-and-tooling.md](004-scripts-and-tooling.md) |
| `supabase/` | – | migrations |

Lib code must type-check in both web and admin, so don't use app-specific typed routes inside `packages/lib`.
