# Security Model

This page describes how the system protects itself. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Trust boundaries

| Surface | Who calls it | Guard |
| --- | --- | --- |
| `api.example.com/v1` | anyone | read-only (`GET`/`HEAD`/`OPTIONS`), public repositories only, rate limit |
| `example.com` pages, `/.well-known`, `/api/ard` | anyone | anon client for reads; ARD index read with service-role; rate limit on `/api/*` |
| `example.com/api/internal/**` | the site's own pages | same-origin, Turnstile on anything that sends mail or stores text, rate limit |
| `admin.example.com` pages | the admin | Cloudflare Access in front of the host, then the Access token checked in the hooks |
| `admin.example.com/api/internal/**` | the admin UI | same-origin + `verifyAdminRequest()` (Access token) |
| `idstead-jobs` | Queues and cron only | no HTTP surface (`fetch` returns 404, `workers_dev: false`) |

## Authentication and MFA (admin)

- **Sign-in:** a Cloudflare Access self-hosted application covers `admin.example.com`. Its policy admits only the owner's email; the login method is the owner's Cloudflare account or another Access login method. Idstead stores no passwords, authenticator secrets or passkeys.
- **MFA:** enforced by Access. Require two-factor authentication in the Access policy or the Zero Trust settings, or turn it on for the Cloudflare account used to sign in.
- **Token check:** Access adds `Cf-Access-Jwt-Assertion` to every request. `accessIdentity()` (`packages/lib/src/server/accessAuth.ts`) verifies the RS256 signature against the team's certs, `iss`, `aud` (`ACCESS_AUD`), `exp` and `type = app`, and, when `ADMIN_EMAILS` is set, the email. A deployed admin without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` refuses every request; only a `vite dev` build on a loopback host uses the `admin@localhost` identity.
- **Destructive actions:** deleting all site data needs a sign-in from the last 10 minutes (token `iat`) and the typed confirmation `DELETE`.
- **Lockout:** failed OpenID Connect client secrets are counted in `db_login_failures` (salted SHA-256 key hashes), shared across isolates, with an in-memory fallback.
- **Session cookie:** `CF_Authorization`, set by Access on `admin.example.com`. Sign-out is `/cdn-cgi/access/logout`.

Details and the flow diagram: [architecture/6](003-architecture/006-admin-sign-in.md).

## Request integrity

- **Same-origin** (`isSameOriginRequest`):
    - When an `Origin` header is present, it must equal the host origin.
    - Without `Origin`, `GET`/`HEAD` pass, and other methods need `Sec-Fetch-Site: same-origin`.
    - Every internal endpoint calls this check.
    - The web hook additionally answers cross-origin `OPTIONS` to `/api/internal/*` with 403.
- **Turnstile:** `verifyTurnstileToken()` calls Cloudflare `siteverify` with `TURNSTILE_SECRET`. It is used by comments, comment reports, subscribe, unsubscribe-request and contact.
- **Rate limiting:** 60 requests per 60 s per IP on `example.com/api/*` and on `api.example.com`, through the Workers Rate Limiting binding `API_RATE_LIMITER`, with an in-memory fallback.
- **Comment moderation:**
    - Every comment is checked by Llama Guard 3 through the Workers AI `AI` binding.
    - Unsafe comments are stored with `is_approved = false` and never shown.
    - If the model is unavailable, the comment is rejected (`503 BLOG_COMMENT_MODERATION_UNAVAILABLE`) rather than accepted unmoderated.
    - Links in comments are refused, and reserved author names are blocked.

## Data access

- **D1 has no row-level security**, so every read and write goes through the server-only data layer (`dataStores()` in `packages/lib/src/server/data.ts`):
    - `public` stores return only published posts, approved comments and the public profile fields; the API worker uses nothing else.
    - `service` stores (writers, admin, newsletter, resume, activity) are used only in server code after the endpoint has checked its caller: same-origin and Turnstile checks for public writes, `requireAdminAuth`/`blogAdmin` (the Cloudflare Access identity) for admin endpoints.
    - ESLint forbids `@idstead/data` and `server/` imports in browser code.
- **No database IDs in public output:** posts are exposed by their 64-hex `public_id`, and comments by no identifier at all.
- **Error scrubbing:** API error messages that mention database internals are replaced with a generic message (`apiEnvelope.ts`).
- **IP privacy:**
    - Public endpoints store IPs only as SHA-256 hashes salted with `IP_SALT`. This covers views, reports, feedback and subscribers.
    - The admin activity log (`packages/lib/src/server/activityLog.ts`) stores the raw `ip` **and** `ip_hash` for admin actions. Those rows are pruned after 30 days by the jobs Worker's daily cron.
    - Every admin action that changes data is logged with the client IP from `clientAddress()`, including comment replies, deletions and report dismissals, and manual newsletter sends. An unknown IP is stored as empty, never as a placeholder address.
        - Sentry request data is filtered by `privateRequestIntegrations()` (`packages/lib/src/server/sentryPrivacy.ts`).

## Content rendering

- Markdown (posts, legal pages) is rendered by the `@mdrs/core` package (`packages/mdrs/core/src/markdown.ts`).
- The output **always** passes through the allow-list sanitizer `sanitizeHtml()` (`packages/mdrs/core/src/sanitize.ts`). `tests/sanitizeHtml.test.ts` covers both hostile input and the engine's own markup.
- Images and banners are re-validated on the server before storage: sizes, pixel limits, magic bytes, WebP decode.

## Response headers

- **CSP** (`buildContentSecurityPolicy`, `packages/lib/src/server/csp.ts`) is set on every HTML response from web and admin:
    - `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`;
    - `script-src` allows `'unsafe-inline'` plus Turnstile, Google Tag Manager, Instatus and Cloudflare Insights;
    - `connect-src` adds the Sentry, CDN and API origins.
- **`apps/web/_headers`** declares `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection` and `Referrer-Policy: strict-origin-when-cross-origin`. Cloudflare applies `_headers` to static asset responses, not to responses generated by the Worker. Images served by the Worker set `nosniff` themselves.
- **Admin and internal endpoints:** `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## Secrets

- Secrets live in Worker secrets and in a local `.env` or secret manager. They are never in the repo.
- The pre-commit hook runs TruffleHog on staged files and blocks the commit on a verified secret.
- GitHub secret scanning and push protection are enabled on the repository.
