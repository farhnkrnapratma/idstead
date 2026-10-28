# Security Model

This page describes how the system protects itself. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Trust boundaries

| Surface | Who calls it | Guard |
| --- | --- | --- |
| `api.example.com/v1` | anyone | read-only (`GET`/`HEAD`/`OPTIONS`), public repositories only, rate limit |
| `example.com` pages, `/.well-known`, `/api/ard` | anyone | anon client for reads; ARD index read with service-role; rate limit on `/api/*` |
| `example.com/api/internal/**` | the site's own pages | same-origin, Turnstile on anything that sends mail or stores text, rate limit |
| `admin.example.com` pages | the admin | Supabase session cookie + role `admin` + MFA, checked in the hooks |
| `admin.example.com/api/internal/**` | the admin UI | same-origin + `verifyAdminToken()` (Bearer token, role, MFA) |
| `idstead-jobs` | Queues and cron only | no HTTP surface (`fetch` returns 404, `workers_dev: false`) |

## Authentication and MFA (admin)

- **Sign-in:** either email + password (Turnstile, lockout, then TOTP when the account has a verified factor), or a passkey.
- **Direct Supabase Auth calls:** anyone can call Supabase Auth's password endpoint directly and skip the login route. Every sign-in (password, passkey, the `data/delete-all` password check) forwards a Turnstile token as `captchaToken`, so turning on **CAPTCHA protection** in the Supabase dashboard (provider Turnstile, the production secret) closes that path. Until it is on, the direct endpoint has only Supabase's own per-IP rate limits, and TOTP or a passkey is still needed for an admin session.
- **MFA rule:** a session is MFA-satisfied when one of these holds:
    - it is a passkey session (`amr` method `passkey`, `webauthn` or `mfa/webauthn`);
    - its `aal` is `aal2`;
    - no `aal2` step is pending.

    The retired Postgres schema mirrored the rule in `public.is_admin()`. D1 has no such check, so every admin endpoint verifies the session with this rule (`requireAdminAuth`/`blogAdmin`) before it touches the service stores.

- **Login lockout:** 5 failures per 15 minutes per IP and per email + IP pair. The email is always paired with the IP, so nobody can lock the admin out from elsewhere just by knowing the address. The counter is shared across isolates in `db_login_failures`, which stores only salted SHA-256 hashes of the `ip:`/`email-ip:` keys and is reachable only through `service_role` RPCs (`db_login_lockout`, `db_login_record_failure`, `db_login_clear`). If the database is unreachable, the isolate's in-memory counter takes over. The password-change and `data/delete-all` routes use the same counter (`password-change:…`, `delete-all:…`). Successful and failed logins go to `db_activity_log`, and every successful login sends an email alert.
- **Session cookie:** host-only on `admin.example.com`, `sameSite=lax`, `secure`.

Details and the flow diagram: [architecture/6](003-architecture/006-admin-login-mfa.md).

## Request integrity

- **Same-origin** (`isSameOriginRequest`):
    - When an `Origin` header is present, it must equal the host origin.
    - Without `Origin`, `GET`/`HEAD` pass, and other methods need `Sec-Fetch-Site: same-origin`.
    - Every internal endpoint calls this check.
    - The web hook additionally answers cross-origin `OPTIONS` to `/api/internal/*` with 403.
- **Turnstile:** `verifyTurnstileToken()` calls Cloudflare `siteverify` with `TURNSTILE_SECRET`. It is used by comments, comment reports, subscribe, unsubscribe-request, contact and admin login.
- **Rate limiting:** 60 requests per 60 s per IP on `example.com/api/*` and on `api.example.com`, through the Workers Rate Limiting binding `API_RATE_LIMITER`, with an in-memory fallback.
- **Comment moderation:**
    - Every comment is checked by Llama Guard 3 through the Workers AI `AI` binding.
    - Unsafe comments are stored with `is_approved = false` and never shown.
    - If the model is unavailable, the comment is rejected (`503 BLOG_COMMENT_MODERATION_UNAVAILABLE`) rather than accepted unmoderated.
    - Links in comments are refused, and reserved author names are blocked.

## Data access

- **D1 has no row-level security**, so every read and write goes through the server-only data layer (`dataStores()` in `packages/lib/src/server/data.ts`):
    - `public` stores return only published posts, approved comments and the public profile fields; the API worker uses nothing else.
    - `service` stores (writers, admin, newsletter, CV, activity) are used only in server code after the endpoint has checked its caller: same-origin and Turnstile checks for public writes, `requireAdminAuth`/`blogAdmin` with MFA for admin endpoints.
    - ESLint forbids `@idstead/data` and `server/` imports in browser code.
- **Supabase is the auth provider only.** The service-role client (`packages/lib/src/server/supabaseAdmin.ts`) verifies admin tokens and manages the admin user; it never reads site data, and it is never imported from `.svelte` files or browser bundles.
- **No database IDs in public output:** posts are exposed by their 64-hex `public_id`, and comments by no identifier at all.
- **Error scrubbing:** API error messages that mention database internals are replaced with a generic message (`apiEnvelope.ts`).
- **IP privacy:**
    - Public endpoints store IPs only as SHA-256 hashes salted with `IP_SALT`. This covers views, reports, feedback and subscribers.
    - The admin activity log (`packages/lib/src/server/activityLog.ts`) stores the raw `ip` **and** `ip_hash` for admin actions and login attempts. Those rows are pruned after 30 days by the jobs Worker's daily cron.
    - Every admin action that changes data is logged with the client IP from `clientAddress()`, including password changes, comment replies, deletions and report dismissals, and manual newsletter sends. An unknown IP is stored as empty, never as a placeholder address.
        - Sentry request data is filtered by `privateRequestIntegrations()` (`packages/lib/src/server/sentryPrivacy.ts`).

## Content rendering

- Markdown (posts, legal pages) is rendered by the `@mdrs/core` package (`packages/mdrs/core/src/markdown.ts`).
- The output **always** passes through the allow-list sanitizer `sanitizeHtml()` (`packages/mdrs/core/src/sanitize.ts`). `tests/sanitizeHtml.test.ts` covers both hostile input and the engine's own markup.
- Images and banners are re-validated on the server before storage: sizes, pixel limits, magic bytes, WebP decode.

## Response headers

- **CSP** (`buildContentSecurityPolicy`, `packages/lib/src/server/csp.ts`) is set on every HTML response from web and admin:
    - `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`;
    - `script-src` allows `'unsafe-inline'` plus Turnstile, Google Tag Manager, Instatus and Cloudflare Insights;
    - `connect-src` adds the Sentry, CDN and API origins, and on admin also the Supabase Auth origin.
- **`apps/web/_headers`** declares `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection` and `Referrer-Policy: strict-origin-when-cross-origin`. Cloudflare applies `_headers` to static asset responses, not to responses generated by the Worker. Images served by the Worker set `nosniff` themselves.
- **Admin and internal endpoints:** `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## Secrets

- Secrets live in Worker secrets and in a local `.env` or secret manager. They are never in the repo.
- The pre-commit hook runs TruffleHog on staged files and blocks the commit on a verified secret.
- GitHub secret scanning and push protection are enabled on the repository.
