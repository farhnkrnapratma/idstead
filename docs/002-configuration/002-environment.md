# Environment Variables

`.env.example` lists every variable once. Locally they come from a `.env` file in the repository root or from a [secret manager](#using-a-secret-manager); in production each Worker reads its own as [Worker secrets](#worker-secrets). Where the instance runs (domains, Worker, bucket and queue names) is not an environment variable: it is [`idstead.jsonc`](001-instance.md).

The columns show which apps read each variable, from a code search on 2026-10-18. `lib` means shared code in `packages/lib` that runs inside those apps.

| Variable | Kind | web | admin | api | jobs | Purpose |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| `ACCESS_TEAM_DOMAIN` | var | – | ✓ | – | – | Cloudflare Zero Trust team domain (`<team>.cloudflareaccess.com`) whose keys sign the Access token on every admin request. Rendered from `access.teamDomain` in `idstead.jsonc`; never set it by hand. |
| `ACCESS_AUD` | var | – | ✓ | – | – | audience tag of the admin's Access application. Rendered from `access.aud`. Without both values a deployed admin answers `401` to everything; only `vite dev` on `localhost` signs in as `admin@localhost`. |
| `ADMIN_EMAILS` | var, optional | – | ✓ | – | – | comma-separated emails the admin accepts in the Access token, checked on top of the Access policy. Setup sets it to the admin email. |
| `DATA_CACHE` | var, optional | ✓ | ✓ | ✓ | ✓ | `1` or `true` caches the public reads (author, posts, comments per post, legal pages) in the Workers Cache API for a day, keyed by the Worker version and the `db_cache_generations` generation of each domain, so a write invalidates them at once. Post lists with view and comment counts are kept for 60 seconds and post renders for 5 minutes; errors are never cached. No effect where the Cache API is missing (local dev). |
| `WRITES_FROZEN` | var, optional | ✓ | ✓ | – | ✓ | `1` or `true` pauses writes for maintenance: `POST`, `PUT`, `PATCH` and `DELETE` requests under `/api/internal/**` answer `503 MAINTENANCE` with `Retry-After: 60`, `/oauth/token` and `/oauth/revoke` answer `503 temporarily_unavailable`, the jobs Worker retries queue messages after 5 minutes and skips its cron run. Reads keep working. |
| `PUBLIC_API_BASE_URL` | public | ✓ | ✓ | – | – | API origin for links, CSP `connect-src` and the OpenAPI mirror. Required: `apiBaseUrl()` throws without it. |
| `PUBLIC_SITE_URL` | public | ✓ | ✓ | – | ✓ | public site origin, used when the author profile has no site URL: for `robots.txt`, the sitemap, the feed, `llms.txt` and the `.well-known` discovery files while no profile exists (`readSite()` in `server/publicMetadata.ts`, which answers 503 only when the database fails), for newsletter links (`configuredSiteUrl` in `server/siteUrl.ts`, which throws without it), for the site links in the resume verification bundle (`adminResume.ts`), and for the generated website banner in admin |
| `PUBLIC_ADMIN_URL` | public, optional | ✓ | – | – | – | admin origin, used as the OpenID Connect `authorization_endpoint` host (`configuredAdminUrl` in `server/siteUrl.ts`). Setup derives it from `domains.admin`; without it the site falls back to `https://admin.<site host>` |
| `PUBLIC_CDN_BASE_URL` | public | ✓ | ✓ | – | ✓ | public R2/CDN origin for `/static`, `/fonts`, `/logo`, resume URLs and the identity fallback |
| `PUBLIC_TURNSTILE_SITE_KEY` | public | ✓ | ✓ | – | – | Turnstile widget key |
| `TURNSTILE_SECRET` | **secret** | ✓ | ✓ | – | – | server-side `siteverify` for the public forms |
| `RESEND_API_KEY` | **secret** | ✓ | ✓ | – | ✓ | email: confirm, contact, newsletter |
| `SUBSCRIBER_FROM_EMAIL` | var | ✓ | ✓ | – | ✓ | sender address for those emails |
| `IP_SALT` | **secret** | ✓ | ✓ | – | – | salt for SHA-256 IP hashing |
| `OIDC_SIGNING_KEY` | **secret**, optional | ✓ | – | – | – | private ES256 JWK (`{"kty":"EC","crv":"P-256","x":…,"y":…,"d":…}`) that signs the OpenID Connect tokens; `bun tooling/oidc-key.ts` prints a new one. Without it "Sign in with Idstead" is off: `/.well-known/openid-configuration` and `/.well-known/jwks.json` answer 404 and WebFinger has no issuer link. It never enters the database or the data export |
| `OIDC_ENABLED` | var, optional | – | ✓ | – | – | `1` or `true` turns on the OpenID Connect authorize and consent pages on the admin host, so the admin Worker never needs `OIDC_SIGNING_KEY`. Set it together with the web Worker's key; setup sets it to `1` whenever `OIDC_SIGNING_KEY` is present |
| `GITHUB_PAT` | **secret**, optional | ✓ | ✓ | – | – | GitHub token whose owner's public, non-fork, non-archived repositories fill the projects section and the admin resume import; a fine-grained token with read-only access to public repositories is enough. Without it there are no projects |
| `PUBLIC_SENTRY_DSN` | public | ✓ | ✓ | ✓ | ✓ | Sentry DSN |
| `PUBLIC_SENTRY_ENVIRONMENT` | public | ✓ | ✓ | ✓ | ✓ | `production`, `preview` or `development`. `preview` also turns on `noindex`. |
| `PUBLIC_GA_MEASUREMENT_ID` | public, optional | ✓ | – | – | – | Google Analytics 4 property for `app.html`. Without it no analytics script loads. |
| `PUBLIC_STATUS_PAGE_HOST`, `PUBLIC_STATUS_PAGE_CODE` | public, optional | ✓ | – | – | – | Instatus page for the footer status badge, hidden without them |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | **secret**, build | – | – | – | – | source-map upload during `vite build` |
| `CLOUDFLARE_API_TOKEN` | **secret**, local | – | – | – | – | wrangler auth, needed for the remote `AI` binding in local dev. Setup also uses it to create the admin's Access application (permissions `Access: Apps and Policies Write` and `Access: Organizations, Identity Providers, and Groups Read`). |
| `CLOUDFLARE_ACCOUNT_ID` | local | – | – | – | – | account that setup creates the Access application in |

## Bindings (not variables)

These are declared in each app's `wrangler.jsonc`. See [deployment](../006-operations/001-deployment.md#bindings).

| Binding | App | Kind |
| --- | --- | --- |
| `ASSETS` | web, admin | Workers static assets |
| `AI` | web, admin | Workers AI (`remote: true`) |
| `API_RATE_LIMITER` | web (namespace 1001), api (namespace 1002), admin (namespace 1003) | Workers Rate Limiting, 60 requests / 60 s |
| `NEWSLETTER_QUEUE` | admin | Queue producer for `idstead-newsletter` |
| `ASSET_BUCKET` | web, admin, jobs | R2 bucket `assetBucket` from `idstead.jsonc`, default `idstead-assets` (`remote: true`): identity assets, banners, content images, resume. Wrapped by `packages/lib/src/server/r2.ts`. |

## Worker secrets

In production each Worker gets its variables as Worker secrets and reads them at **runtime**, never at build time. Each Worker needs only the keys it reads, which are the columns above:

- `api`: `secrets.required` in `apps/api/wrangler.template.jsonc`.
- `jobs`: `secrets.required` in `apps/jobs/wrangler.template.jsonc`.
- `web` and `admin`: the keys declared in `apps/web/src/env.ts` and `apps/admin/src/env.ts` that have a value.

`wrangler deploy` fails for `api` and `jobs` while a key in their `secrets.required` is missing on the Worker. The [setup script](../001-getting-started/001-setup-script.md) uploads each Worker's secrets with its deploy; afterwards, change one with `bunx wrangler secret put <KEY> --name <worker>`.

Build-time and tooling values are never Worker secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` (source-map upload during `vite build`), and `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (wrangler and setup). `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are plain Worker variables rendered into `apps/admin/wrangler.jsonc`, not secrets.

## Using a secret manager

A `.env` file in the repository root is enough for local work. To keep the values in a secret manager instead, start every command through it so the variables reach the process, for example with [Phase](https://phase.dev):

```sh
phase run --env dev -- bun run dev
phase run --env prod -- bun run setup
```

A secret manager can also own the Worker secrets. With Phase, give each Worker a folder such as `/workers/web` that references the root values (`PUBLIC_SITE_URL = ${PUBLIC_SITE_URL}`), and sync each folder to its Worker. The sync is one-way and the secret manager is authoritative, so a key missing from a folder is removed from the Worker: then change values only in the secret manager, never in the Cloudflare dashboard.

## Where they are read

- **Svelte apps:** `apps/web/src/env.ts` and `apps/admin/src/env.ts` declare the schema. Code reads values through `$app/env/private` and `$app/env/public`.
- **Wrangler workers:**
    - `apps/api` reads `c.env`, and like jobs aliases `$app/env/*` to its `src/appEnv.ts`.
    - `apps/jobs` aliases `$app/env/*` to `src/appEnv.ts`, which reads the `cloudflare:workers` env, so shared lib code runs unchanged.
- **Cloudflare bindings in SvelteKit:** read them through `workerBinding()` (`packages/lib/src/server/workerEnv.ts`), because `event.platform` is undefined with adapter-cloudflare 8.

## Rules

- Never commit secrets. The pre-commit hook runs TruffleHog on staged files.
- Never import server-only modules (`server/**`, `@idstead/data`) from a `.svelte` file or from browser code.
- When a secret manager syncs the Worker secrets, create or rotate them there only.
