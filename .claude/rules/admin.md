---
paths:
    - apps/admin/**
---

# Admin (`apps/admin`)

- Pages live in the `(admin)` route group at the host root: `/` (dashboard), `/new`, `/oauth/authorize`. Cloudflare Access covers the whole host; `src/hooks.server.ts` verifies the `Cf-Access-Jwt-Assertion` token (`#lib/server/accessAuth.ts`) and answers `401` to pages without one. Idstead has no login page, password, TOTP or passkey code: MFA and sessions are Access settings. Sign-out is `/cdn-cgi/access/logout`.
- API routes verify the same token through `requireAdminAuth`/`blogAdmin` (`verifyAdminRequest`); the activity log actor is the Access email. Browser code calls them with `adminFetch`/`adminRequest` (`src/lib/adminClient.ts`): same-origin fetches without an `Authorization` header that report an expired Access session instead of reloading the page.
- Without `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` only `vite dev` on a loopback host signs in, as `admin@localhost`. Every response is `noindex` and `no-store`; `robots.txt` disallows everything; `app.html` sets `data-admin-page="true"`.
- `/api/internal/admin/**` keeps its paths. Links to public pages use the author profile's `siteUrl`.
- Publishing a post enqueues a newsletter queue message (`NEWSLETTER_QUEUE` binding); without the binding it delivers in the request. Manual re-sends stay synchronous.
