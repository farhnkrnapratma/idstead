# Environment Variables

`.env.example` lists every variable once. Locally they come from a `.env` file in the repository root or from a [secret manager](#using-a-secret-manager); in production each Worker reads its own as [Worker secrets](#worker-secrets). Where the instance runs (domains, Worker, bucket and queue names) is not an environment variable: it is [`idstead.jsonc`](001-instance.md).

The columns show which apps read each variable, from a code search on 2026-10-18. `lib` means shared code in `packages/lib` that runs inside those apps.

| Variable | Kind | web | admin | api | jobs | Purpose |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| `PUBLIC_SUPABASE_URL` | public | ✓ | ✓ | ✓ | ✓ | Supabase project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | ✓ | ✓ | ✓ | ✓ | anon/publishable key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | ✓ | ✓ | – | ✓ | service-role client that bypasses RLS. Server-only. The API worker never has it. |
| `DATA_BACKEND` | var, optional | ✓ | ✓ | ✓ | ✓ | data adapter that `dataStores()` (`server/data.ts`) builds every store from: `supabase` (the default) or `d1`, which reads the `DB` binding for data and the `ASSET_BUCKET` binding for post content. Anything else throws. |
| `WRITES_FROZEN` | var, optional | ✓ | ✓ | – | ✓ | `1` or `true` pauses writes for maintenance: `POST`, `PUT`, `PATCH` and `DELETE` requests under `/api/internal/**` answer `503 MAINTENANCE` with `Retry-After: 60`, the jobs Worker retries queue messages after 5 minutes and skips its cron run. Reads keep working. |
| `PUBLIC_API_BASE_URL` | public | ✓ | ✓ | – | – | API origin for links, CSP `connect-src` and the OpenAPI mirror. Required: `apiBaseUrl()` throws without it. |
| `PUBLIC_SITE_URL` | public | – | ✓ | – | ✓ | public site origin, used when the author profile has no site URL: for newsletter links (`configuredSiteUrl` in `server/siteUrl.ts`, which throws without it), for the site links in the CV verification bundle (`adminCv.ts`), and for the generated website banner in admin |
| `PUBLIC_CDN_BASE_URL` | public | ✓ | ✓ | – | ✓ | public R2/CDN origin for `/static`, `/fonts`, `/logo`, CV URLs and the identity fallback |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **secret**, script | – | – | – | – | S3-API access to the R2 bucket for `scripts/migrate-cdn-layout.ts`, which runs with bun outside Workers. The Workers use the `ASSET_BUCKET` binding instead. |
| `PUBLIC_TURNSTILE_SITE_KEY` | public | ✓ | ✓ | – | – | Turnstile widget key |
| `TURNSTILE_SECRET` | **secret** | ✓ | ✓ | – | – | server-side `siteverify`. The production value is also the Supabase Auth CAPTCHA secret. |
| `RESEND_API_KEY` | **secret** | ✓ | ✓ | – | ✓ | email: confirm, contact, login alert, newsletter |
| `SUBSCRIBER_FROM_EMAIL` | var | ✓ | ✓ | – | ✓ | sender address for those emails |
| `IP_SALT` | **secret** | ✓ | ✓ | – | – | salt for SHA-256 IP hashing |
| `GITHUB_PAT` | **secret**, optional | ✓ | ✓ | – | – | raises the GitHub API rate limit for the projects section and the admin CV import |
| `PUBLIC_SENTRY_DSN` | public | ✓ | ✓ | ✓ | ✓ | Sentry DSN |
| `PUBLIC_SENTRY_ENVIRONMENT` | public | ✓ | ✓ | ✓ | ✓ | `production`, `preview` or `development`. `preview` also turns on `noindex`. |
| `PUBLIC_GA_MEASUREMENT_ID` | public, optional | ✓ | – | – | – | Google Analytics 4 property for `app.html`. Without it no analytics script loads. |
| `PUBLIC_STATUS_PAGE_HOST`, `PUBLIC_STATUS_PAGE_CODE` | public, optional | ✓ | – | – | – | Instatus page for the footer status badge, hidden without them |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | **secret**, build | – | – | – | – | source-map upload during `vite build` |
| `CLOUDFLARE_API_TOKEN` | **secret**, local | – | – | – | – | wrangler auth, needed for the remote `AI` binding in local dev |
| `SUPABASE_ACCESS_TOKEN` | **secret**, local | – | – | – | – | Supabase CLI/MCP. Not read by the apps. |

## Bindings (not variables)

These are declared in each app's `wrangler.jsonc`. See [deployment](../006-operations/001-deployment.md#bindings).

| Binding | App | Kind |
| --- | --- | --- |
| `ASSETS` | web, admin | Workers static assets |
| `AI` | web, admin | Workers AI (`remote: true`) |
| `API_RATE_LIMITER` | web (namespace 1001), api (namespace 1002), admin (namespace 1003) | Workers Rate Limiting, 60 requests / 60 s |
| `NEWSLETTER_QUEUE` | admin | Queue producer for `idstead-newsletter` |
| `ASSET_BUCKET` | web, admin, jobs | R2 bucket `assetBucket` from `idstead.jsonc`, default `idstead-assets` (`remote: true`): identity assets, banners, content images, CV. Wrapped by `packages/lib/src/server/r2.ts`. |

## Worker secrets

In production each Worker gets its variables as Worker secrets and reads them at **runtime**, never at build time. Each Worker needs only the keys it reads, which are the columns above:

- `api`: `secrets.required` in `apps/api/wrangler.template.jsonc`.
- `jobs`: `secrets.required` in `apps/jobs/wrangler.template.jsonc`.
- `web` and `admin`: the keys declared in `apps/web/src/env.ts` and `apps/admin/src/env.ts` that have a value.

`wrangler deploy` fails for `api` and `jobs` while a key in their `secrets.required` is missing on the Worker. The [setup script](../001-getting-started/001-setup-script.md) uploads each Worker's secrets with its deploy; afterwards, change one with `bunx wrangler secret put <KEY> --name <worker>`.

Build-time and tooling values are never Worker secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` (source-map upload during `vite build`), `CLOUDFLARE_API_TOKEN` and `SUPABASE_ACCESS_TOKEN` (tooling), and the `R2_*` keys (`scripts/migrate-cdn-layout.ts`).

## Using a secret manager

A `.env` file in the repository root is enough for local work. To keep the values in a secret manager instead, start every command through it so the variables reach the process, for example with [Phase](https://phase.dev):

```sh
phase run --env dev -- bun run dev
phase run --env prod -- bun run setup
```

A secret manager can also own the Worker secrets. With Phase, give each Worker a folder such as `/workers/web` that references the root values (`PUBLIC_SUPABASE_URL = ${PUBLIC_SUPABASE_URL}`), and sync each folder to its Worker. The sync is one-way and the secret manager is authoritative, so a key missing from a folder is removed from the Worker: then change values only in the secret manager, never in the Cloudflare dashboard.

## Where they are read

- **Svelte apps:** `apps/web/src/env.ts` and `apps/admin/src/env.ts` declare the schema. Code reads values through `$app/env/private` and `$app/env/public`.
- **Wrangler workers:**
    - `apps/api` reads `c.env`.
    - `apps/jobs` aliases `$app/env/*` to `src/appEnv.ts`, which reads the `cloudflare:workers` env, so shared lib code runs unchanged.
- **Cloudflare bindings in SvelteKit:** read them through `workerBinding()` (`packages/lib/src/server/workerEnv.ts`), because `event.platform` is undefined with adapter-cloudflare 8.

## Rules

- Never commit secrets. The pre-commit hook runs TruffleHog on staged files.
- Never import `server/supabaseAdmin.ts` or other server-only modules from a `.svelte` file or from browser code.
- When a secret manager syncs the Worker secrets, create or rotate them there only.
