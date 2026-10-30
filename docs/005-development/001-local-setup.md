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
bun run db:local                         # create or migrate the shared local D1 database
bun run dev                              # public site (Vite)
bun run dev:admin                        # admin portal, http://localhost:5174
bun run --filter @idstead/api dev        # API worker, http://localhost:8787
bun run --filter @idstead/jobs dev       # jobs worker, http://localhost:8788 (--test-scheduled)
```

- **Local database:** the dev servers never touch production data. `bun run db:local` applies `packages/data/d1/migrations/` to a local D1 database in `.wrangler/state/v3` at the repository root, which the web and admin dev servers share (`platformProxy.persist` in their Vite configs). Run it again after pulling a new migration. It starts empty; open the local admin portal to create a profile and posts.
- **Remote bindings:** the `ASSET_BUCKET` R2 bucket and the `AI` binding are `remote: true`, so uploads in local dev reach the real bucket.
- At minimum, `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL` must be set.
- **Local admin sign-in:** with no `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, the admin dev server on `localhost` signs you in as `admin@localhost` without Cloudflare Access. A production build never does.
- For what each variable does and which app reads it, see [environment.md](../002-configuration/002-environment.md).
- With a secret manager instead of a `.env` file, start each command through it, for example `phase run --env dev -- bun run dev` with [Phase](https://phase.dev) ([environment.md](../002-configuration/002-environment.md#using-a-secret-manager)).

### Local tips

- **Local API:** to point the site at a locally running API, set `PUBLIC_API_BASE_URL=http://localhost:8787` for the web process.
- **Workers AI:** the `AI` binding is `remote: true`, so local dev calls real Workers AI. It needs `CLOUDFLARE_API_TOKEN` for wrangler auth. Comment moderation and ARD search do not work offline.
- **Turnstile:** development uses Cloudflare's dummy Turnstile keys for the public forms.

## Everyday commands

```sh
bun run check        # svelte-check (web, admin) + tsc (api, jobs, mdrs, tests/tooling/scripts)
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
| `tooling/` | – | [scripts-and-tooling.md](003-scripts-and-tooling.md) |
| `packages/data/d1/` | – | D1 migrations |
| `templates/` | – | starter content for a new site |

Lib code must type-check in both web and admin, so don't use app-specific typed routes inside `packages/lib`.
