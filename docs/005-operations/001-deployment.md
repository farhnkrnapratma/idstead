# Deployment

Each app is a Cloudflare Worker connected to [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Every one uses root directory `/`, so the whole Bun workspace installs from the root `bun.lock`. The build commands change into the app first, because `wrangler deploy` refuses to run from a workspace root.

| Worker | Build | Deploy | Watch paths |
| --- | --- | --- | --- |
| `fkp-web` | `cd apps/web && bun run build` | `cd apps/web && bunx wrangler deploy` | `apps/web/*`, `packages/*`, `package.json`, `bun.lock`, `bunfig.toml` |
| `fkp-admin` | `cd apps/admin && bun run build` | `cd apps/admin && bunx wrangler deploy` | `apps/admin/*`, `packages/*`, … |
| `fkp-api` | `cd apps/api && bun run build` | `cd apps/api && bunx wrangler deploy` | `apps/api/*`, `packages/*`, … |
| `fkp-jobs` | `cd apps/jobs && bun run build` | `cd apps/jobs && bunx wrangler deploy` | `apps/jobs/*`, `packages/*`, … |

There is no CI. Run `bun run test`, `bun run check` and `bun run lint` locally before you push or merge to `main`.

## Environments

- **Production:** every push to `main` deploys, and `main` only receives `release/*` and `hotfix/*` merges (git-flow-next). The Worker secrets are synced from Phase (`/workers/<app>` in Production, see [environment.md](../004-development/002-environment.md#phase-layout-and-sync-to-cloudflare)), including real Turnstile keys and `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Preview:** not connected yet. The triggers watch `main` only, so `develop` and PR branches deploy nothing.
    - To add previews, create a branch trigger per Worker.
    - Give previews their own variables: Cloudflare's dummy Turnstile keys and `PUBLIC_SENTRY_ENVIRONMENT=preview`.
    - `*.workers.dev` hosts and `preview` deployments are served with `noindex` and a disallow-all `robots.txt`.

All Workers share one Supabase project.

## Bindings

Taken from each `wrangler.jsonc` (all of them use `compatibility_date 2025-06-28` and `nodejs_compat`):

| Worker | Routes | Bindings and triggers |
| --- | --- | --- |
| `fkp-web` | `fkp.my.id`, `www.fkp.my.id` (custom domains) | `ASSETS` (static assets), `AI` (Workers AI, `remote: true`), `ratelimits` `API_RATE_LIMITER` (namespace `1001`, 60 requests / 60 s), observability |
| `fkp-admin` | `admin.fkp.my.id` | `ASSETS`, `AI` (`remote: true`), queue producer `NEWSLETTER_QUEUE` → `fkp-newsletter`, observability |
| `fkp-api` | `api.fkp.my.id` | `ratelimits` `API_RATE_LIMITER` (namespace `1002`), a `Text` rule for `**/*.md` (bundles `README.md`), observability |
| `fkp-jobs` | none (`workers_dev: false`) | queue consumers on `fkp-newsletter` (`max_batch_size 10`, `max_retries 5`, `dead_letter_queue fkp-newsletter-dlq`) and `fkp-newsletter-dlq` (`max_retries 0`, reports to Sentry), cron `17 3 * * *`, `$app/env/*` alias to `src/appEnv.ts`, observability |

R2 is **not** bound. Code reaches it through the S3 API with the `R2_*` secrets (see [environment.md](../004-development/002-environment.md)).

## One-time setup

1. Create the queues: `bunx wrangler queues create fkp-newsletter` and `bunx wrangler queues create fkp-newsletter-dlq`.
2. In Supabase Auth, add `https://admin.fkp.my.id` to the redirect URLs and to the Passkeys **Relying Party Origins**.
3. In the Phase Console, sync each `/workers/<app>` folder of Production to its Worker ([environment.md](../004-development/002-environment.md#phase-layout-and-sync-to-cloudflare)).

## Database migrations

- Files live in `supabase/migrations/`.
- Production has been migrated partly through the Supabase MCP tool, so recorded versions differ from the file names. Compare the live schema before you assume a migration is applied.
- Apply a migration **before** deploying code that depends on it.
- Every `UPDATE`/`DELETE` inside a function needs a `WHERE` clause (PostgREST `safeupdate`, enforced by `tests/safeupdate.test.ts`).

## After a deploy

- Check Workers observability or Sentry (filtered by `PUBLIC_SENTRY_ENVIRONMENT`) for errors.
- Smoke-test the public API: `curl -I https://api.fkp.my.id/v1/blog` should return `200` with `ETag` and `X-RateLimit-*` headers.
- If the newsletter changed, follow [newsletter.md](002-newsletter.md).
