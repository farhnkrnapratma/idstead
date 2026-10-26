---
paths:
    - apps/admin/**
---

# Admin (`apps/admin`)

- Pages live in the `(admin)` route group at the host root: `/` (dashboard), `/login`, `/new`. The group layout and `src/hooks.server.ts` both enforce an admin session with MFA; a passkey sign-in (`amr` method `passkey`) satisfies MFA.
- Supabase auth cookies are host-only on the admin host. Every response is `noindex` and `no-store`; `robots.txt` disallows everything; `app.html` sets `data-admin-page="true"`.
- `/api/internal/admin/**` keeps its paths; login has its own lockout (`server/loginRateLimit.ts`). Links to public pages use the author profile's `siteUrl`.
- Publishing a post enqueues a newsletter queue message (`NEWSLETTER_QUEUE` binding); without the binding it delivers in the request. Manual re-sends stay synchronous.
