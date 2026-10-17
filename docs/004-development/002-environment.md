# Environment Variables

All variables live in Phase (app `www`, environments Development and Production), and Phase is the only place to create, change or rotate them. In production each Worker gets its variables as Worker secrets that Phase syncs; the Workers read them at **runtime**, never at build time. The variable names are listed in `.env.example`, which has the same keys as the Phase root path of both environments.

The columns show which apps read each variable, from a code search on 2026-10-18. `lib` means shared code in `packages/lib` that runs inside those apps.

| Variable | Kind | web | admin | api | jobs | Purpose |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| `PUBLIC_SUPABASE_URL` | public | ✓ | ✓ | ✓ | ✓ | Supabase project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | ✓ | ✓ | ✓ | ✓ | anon/publishable key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | ✓ | ✓ | – | ✓ | service-role client that bypasses RLS. Server-only. The API worker never has it. |
| `PUBLIC_API_BASE_URL` | public | ✓ | ✓ | – | – | API origin for links, CSP `connect-src` and the OpenAPI mirror (default `https://api.fkp.my.id`) |
| `PUBLIC_SITE_URL` | public | – | ✓ | – | ✓ | public site origin, used when the author profile has no site URL: for newsletter links (`configuredSiteUrl` in `server/siteUrl.ts`, default `https://fkp.my.id`), for the site links in the CV verification bundle (`adminCv.ts`), and for the generated website banner in admin |
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
| `SENTRY_AUTH_TOKEN` | **secret**, build | – | – | – | – | source-map upload during `vite build` |
| `CLOUDFLARE_API_TOKEN` | **secret**, local | – | – | – | – | wrangler auth, needed for the remote `AI` binding in local dev |
| `SUPABASE_ACCESS_TOKEN` | **secret**, local | – | – | – | – | Supabase CLI/MCP. Not read by the apps. |

## Bindings (not variables)

These are declared in each app's `wrangler.jsonc`. See [deployment](../005-operations/001-deployment.md#bindings).

| Binding | App | Kind |
| --- | --- | --- |
| `ASSETS` | web, admin | Workers static assets |
| `AI` | web, admin | Workers AI (`remote: true`) |
| `API_RATE_LIMITER` | web (namespace 1001), api (namespace 1002), admin (namespace 1003) | Workers Rate Limiting, 60 requests / 60 s |
| `NEWSLETTER_QUEUE` | admin | Queue producer for `fkp-newsletter` |
| `ASSET_BUCKET` | web, admin, jobs | R2 bucket `static` (`remote: true`): identity assets, banners, content images, CV. Wrapped by `packages/lib/src/server/r2.ts`. |

## Phase layout and sync to Cloudflare

- **Root path `/`** holds every value. `phase run` reads it for local work, scripts and tooling.
- **`/workers/<app>`** (Production only) holds one reference per variable that Worker needs, such as `PUBLIC_SUPABASE_URL = ${PUBLIC_SUPABASE_URL}`. Change a value only at the root, and every folder that references it follows.
- **Phase syncs** each folder to its Worker as encrypted secrets: `/workers/web` → `fkp-web`, `/workers/admin` → `fkp-admin`, `/workers/api` → `fkp-api`, `/workers/jobs` → `fkp-jobs`. The sync is one-way and Phase is authoritative, so a key missing from a folder is removed from that Worker. Never edit Worker variables in the Cloudflare dashboard.
- **What each folder holds:**
    - `api`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SENTRY_DSN`, `PUBLIC_SENTRY_ENVIRONMENT`.
    - `jobs`: the `api` set plus `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_CDN_BASE_URL`, `RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL`, `PUBLIC_SITE_URL`. It still references the four `R2_*` keys; remove them once the release with the `ASSET_BUCKET` binding is live in production.
    - `admin`: the `jobs` set (without `R2_*`) plus `IP_SALT`, `TURNSTILE_SECRET`, `PUBLIC_TURNSTILE_SITE_KEY`, `GITHUB_PAT`, `PUBLIC_API_BASE_URL`.
    - `web`: the `admin` set without `PUBLIC_SITE_URL`.
- **Never synced:** `SENTRY_AUTH_TOKEN` (build only), `CLOUDFLARE_API_TOKEN` and `SUPABASE_ACCESS_TOKEN` (tooling). The `R2_*` keys stay at the root for `scripts/migrate-cdn-layout.ts`. When you add a variable, add it at the root of both environments and as a reference in each folder whose Worker reads it.

## Where they are read

- **Svelte apps:** `apps/web/src/env.ts` and `apps/admin/src/env.ts` declare the schema. Code reads values through `$app/env/private` and `$app/env/public`.
- **Wrangler workers:**
    - `apps/api` reads `c.env`.
    - `apps/jobs` aliases `$app/env/*` to `src/appEnv.ts`, which reads the `cloudflare:workers` env, so shared lib code runs unchanged.
- **Cloudflare bindings in SvelteKit:** read them through `workerBinding()` (`packages/lib/src/server/workerEnv.ts`), because `event.platform` is undefined with adapter-cloudflare 8.

## Rules

- Never commit secrets. The pre-commit hook runs TruffleHog on staged files.
- Never import `server/supabaseAdmin.ts` or other server-only modules from a `.svelte` file or from browser code.
- Create or rotate secrets in Phase only. The Phase sync updates the Workers.
