# Environment Variables

All variables live in Phase (app `www`, environments Development and Production). In production they are Worker variables or secrets, read at **runtime** and never baked in at build time. The variable names are listed in `.env.production.example` and `.env.development.example`, which have the same keys.

The columns show which apps read each variable, from a code search on 2026-10-15. `lib` means shared code in `packages/lib` that runs inside those apps.

| Variable | Kind | web | admin | api | jobs | Purpose |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| `PUBLIC_SUPABASE_URL` | public | ✓ | ✓ | ✓ | ✓ | Supabase project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | ✓ | ✓ | ✓ | ✓ | anon/publishable key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | ✓ | ✓ | – | ✓ | service-role client that bypasses RLS. Server-only. The API worker never has it. |
| `PUBLIC_API_BASE_URL` | public | ✓ | ✓ | – | – | API origin for links, CSP `connect-src` and the OpenAPI mirror (default `https://api.fkp.my.id`) |
| `PUBLIC_SITE_URL` | public | – | ✓ | – | ✓ | public site origin. Jobs uses it for newsletter links (default `https://fkp.my.id`). Admin uses it for the generated website banner (working tree, 2026-10-15). |
| `PUBLIC_CDN_BASE_URL` | public | ✓ | ✓ | – | ✓ | public R2/CDN origin for `/static`, `/fonts`, `/logo`, CV URLs and the identity fallback |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **secret** | ✓ | ✓ | – | ✓ | S3-API access to the R2 bucket (identity assets, banners, content images, CV) |
| `R2_ENDPOINT` | – | – | – | – | – | in the templates but **not read by any code**. The endpoint is built from `R2_ACCOUNT_ID`. |
| `PUBLIC_TURNSTILE_SITE_KEY` | public | ✓ | ✓ | – | – | Turnstile widget key |
| `TURNSTILE_SECRET` | **secret** | ✓ | ✓ | – | (✓) | server-side `siteverify`. The production value is also the Supabase Auth CAPTCHA secret (set in the Supabase dashboard). Jobs only types it in `app.d.ts` and never reads it. |
| `RESEND_API_KEY` | **secret** | ✓ | ✓ | – | ✓ | email: confirm, contact, login alert, newsletter |
| `SUBSCRIBER_FROM_EMAIL` | var | ✓ | ✓ | – | ✓ | sender address for those emails |
| `IP_SALT` | **secret** | ✓ | ✓ | – | – | salt for SHA-256 IP hashing |
| `GITHUB_PAT` | **secret**, optional | ✓ | ✓ | – | – | raises the GitHub API rate limit for the projects section |
| `PUBLIC_SENTRY_DSN` | public | ✓ | ✓ | ✓ | ✓ | Sentry DSN |
| `PUBLIC_SENTRY_ENVIRONMENT` | public | ✓ | ✓ | ✓ | ✓ | `production`, `preview` or `development`. `preview` also turns on `noindex`. |
| `SENTRY_AUTH_TOKEN` | **secret**, build | – | – | – | – | source-map upload during `vite build` |
| `CLOUDFLARE_API_TOKEN` | **secret**, local | – | – | – | – | wrangler auth, needed for the remote `AI` binding in local dev |
| `SUPABASE_ACCESS_TOKEN` | **secret**, local | – | – | – | – | Supabase CLI/MCP. Not read by the apps. |

## Bindings (not variables)

These are declared in each app's `wrangler.jsonc`. See [deployment](../operations/deployment.md#bindings).

| Binding | App | Kind |
| --- | --- | --- |
| `ASSETS` | web, admin | Workers static assets |
| `AI` | web, admin | Workers AI (`remote: true`) |
| `API_RATE_LIMITER` | web (namespace 1001), api (namespace 1002) | Workers Rate Limiting, 60 requests / 60 s |
| `NEWSLETTER_QUEUE` | admin | Queue producer for `fkp-newsletter` |

## Where they are read

- **Svelte apps:** `apps/web/src/env.ts` and `apps/admin/src/env.ts` declare the schema. Code reads values through `$app/env/private` and `$app/env/public`.
- **Wrangler workers:**
    - `apps/api` reads `c.env`.
    - `apps/jobs` aliases `$app/env/*` to `src/appEnv.ts`, which reads the `cloudflare:workers` env, so shared lib code runs unchanged.
- **Cloudflare bindings in SvelteKit:** read them through `workerBinding()` (`packages/lib/src/server/workerEnv.ts`), because `event.platform` is undefined with adapter-cloudflare 8.

## Rules

- Never commit secrets. The pre-commit hook runs TruffleHog on staged files.
- Never import `server/supabaseAdmin.ts` or other server-only modules from a `.svelte` file or from browser code.
- Create or rotate secrets in Phase. In production, set them as Worker secrets.
