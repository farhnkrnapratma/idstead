# Deployment

The [setup script](../001-getting-started/001-setup-script.md) deploys every Worker once. For continuous deployment, connect each Worker to your repository in [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Every one uses root directory `/`, so the whole Bun workspace installs from the root `bun.lock`. The build commands change into the app first, because `wrangler deploy` refuses to run from a workspace root.

| Worker | Build | Deploy | Watch paths |
| --- | --- | --- | --- |
| `idstead-web` | `cd apps/web && bun run build` | `cd apps/web && bunx wrangler deploy` | `apps/web/*`, `packages/{lib,data,domain,ui}/*`, `packages/mdrs/{core,dom}/*` |
| `idstead-admin` | `cd apps/admin && bun run build` | `cd apps/admin && bunx wrangler deploy` | `apps/admin/*`, `packages/*` |
| `idstead-api` | `cd apps/api && bun run build` | `cd apps/api && bunx wrangler deploy` | `apps/api/*`, `packages/{lib,data,domain}/*`, `packages/mdrs/core/*` |
| `idstead-jobs` | `cd apps/jobs && bun run build` | `cd apps/jobs && bunx wrangler deploy` | `apps/jobs/*`, `packages/{lib,data,domain}/*`, `packages/mdrs/core/*` |

Every trigger also watches `package.json`, `bun.lock` and `bunfig.toml`, and build caching is on. A Worker that starts importing another package needs that package in its watch paths, or changes to it will not redeploy the Worker. The Worker names, routes and resource names come from `idstead.jsonc` through the committed `apps/*/wrangler.jsonc` ([instance configuration](../002-configuration/001-instance.md)).

There is no CI pipeline. Run `bun run test`, `bun run check` and `bun run lint` locally before you push or merge to `main`.

## Environments

- **Production:** every push to `main` deploys, and `main` only receives `release/*` and `hotfix/*` merges (git-flow-next). Workers Builds does not touch the [Worker secrets](../002-configuration/002-environment.md#worker-secrets); they hold real Turnstile keys and `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Preview:** not connected yet. The triggers watch `main` only, so `develop` and PR branches deploy nothing.
    - To add previews, create a branch trigger per Worker.
    - Give previews their own variables: Cloudflare's dummy Turnstile keys and `PUBLIC_SENTRY_ENVIRONMENT=preview`.
    - `*.workers.dev` hosts and `preview` deployments are served with `noindex` and a disallow-all `robots.txt`.

All Workers share one Supabase project.

## Bindings

Taken from each `wrangler.jsonc` (all of them use `compatibility_date 2025-06-28` and `nodejs_compat`):

| Worker | Routes | Bindings and triggers |
| --- | --- | --- |
| `idstead-web` | `example.com`, `www.example.com` (custom domains) | `ASSETS` (static assets), `AI` (Workers AI, `remote: true`), `ASSET_BUCKET` (R2 bucket `idstead-assets`, `remote: true`), `ratelimits` `API_RATE_LIMITER` (namespace `1001`, 60 requests / 60 s), observability |
| `idstead-admin` | `admin.example.com` | `ASSETS`, `AI` (`remote: true`), `ASSET_BUCKET` (`remote: true`), `ratelimits` `API_RATE_LIMITER` (namespace `1003`), queue producer `NEWSLETTER_QUEUE` → `idstead-newsletter`, observability |
| `idstead-api` | `api.example.com` | `ratelimits` `API_RATE_LIMITER` (namespace `1002`), a `Text` rule for `**/*.md` (bundles `README.md`), observability |
| `idstead-jobs` | none (`workers_dev: false`) | `ASSET_BUCKET` (`remote: true`), queue consumers on `idstead-newsletter` (`max_batch_size 10`, `max_retries 5`, `dead_letter_queue idstead-newsletter-dlq`) and `idstead-newsletter-dlq` (`max_retries 0`, reports to Sentry), cron `17 3 * * *`, `$app/env/*` alias to `src/appEnv.ts`, observability |

R2 is bound as `ASSET_BUCKET` (the `assetBucket` from `idstead.jsonc`) on web, admin and jobs, and `packages/lib/src/server/r2.ts` wraps it. The Workers do not read the `R2_*` variables; only `scripts/migrate-cdn-layout.ts` uses them, through the S3 API (see [environment.md](../002-configuration/002-environment.md)).

## One-time setup

The [setup script](../001-getting-started/001-setup-script.md) creates the bucket and queues, the admin account and the Worker secrets, and lists the dashboard steps it cannot do under [After setup](../001-getting-started/README.md#after-setup).

## Database migrations

- Files live in `supabase/migrations/`.
- Production has been migrated partly through the Supabase MCP tool, so recorded versions differ from the file names. Compare the live schema before you assume a migration is applied.
- Apply a migration **before** deploying code that depends on it.
- Every `UPDATE`/`DELETE` inside a function needs a `WHERE` clause (PostgREST `safeupdate`, enforced by `tests/safeupdate.test.ts`).

## After a deploy

- Check Workers observability or Sentry (filtered by `PUBLIC_SENTRY_ENVIRONMENT`) for errors.
- Smoke-test the public API: `curl -I https://api.example.com/v1/blog` should return `200` with `ETag` and `X-RateLimit-*` headers.
- If the newsletter changed, follow [newsletter.md](002-newsletter.md).
