# 10. Endpoint Reference

Every route on the three hosts that serve traffic, with its guard. The lists were checked against the route files on 2026-10-18. To regenerate them:

```sh
rg -n "export const (GET|POST|PUT|DELETE|PATCH)" apps/web/src/routes apps/admin/src/routes -g '+server.ts'
rg --files --hidden apps/web/src/routes apps/admin/src/routes
rg -n "^app\.get" apps/api/src/index.ts
```

## idstead-api: `api.example.com` (public, read-only)

All routes are `GET`/`HEAD` (`OPTIONS` returns 204), rate-limited to 60 requests per minute per IP, use the anon client, and are CORS `*`. Full reference: [docs/004-api/001-v1](../004-api/001-v1/README.md).

| Route                                  | Handler                                       |
| -------------------------------------- | --------------------------------------------- |
| `/`                                    | 301 to `/v1`                                  |
| `/robots.txt`                          | static                                        |
| `/v1`                                  | `getRoot` (README as markdown, or JSON index) |
| `/v1/blog`                             | `getBlog` (list, or one post with `?id=`)     |
| `/v1/blog/content`                     | `getBlogContent`                              |
| `/v1/blog/comments`                    | `getBlogComments`                             |
| `/v1/blog/views`                       | `getBlogViews`                                |
| `/v1/author`                           | `getAuthor`                                   |
| `/v1/cv`                               | `getAuthor(ctx, ['cv'])`                      |
| `/v1/search`                           | `getSearch`                                   |
| `/v1/openapi.json`, `/v1/openapi.yaml` | `openapiSpec`                                 |

## idstead-web: `example.com`

### Pages

`/`, `/projects`, `/blog`, `/blog/[slug]`, `/cv`, `/funding`, `/contact`, `/feedback`, `/privacy`, `/terms`, `/security`, `/subscribe/confirm`, `/unsubscribe`. These are server loads with the anon client, except that the subscribe/unsubscribe pages use service-role. `GET /unsubscribe?token=` only stores the token in a short-lived httpOnly cookie and shows a confirm button; the page's default form action (`POST /unsubscribe`) unsubscribes. `/privacy`, `/terms` and `/security` answer 404 while their `db_legals` row is missing or empty, and the root layout returns the published ones as `legalPages`, so the footer, consent notices, Spotlight, keyboard shortcuts and the sitemap leave the others out. `/home` redirects 308 to `/`; the homepage replaces a legacy `/#section` URL with the matching page.

### Files and feeds (GET)

| Route | Notes |
| --- | --- |
| `/blog/[slug].md`, `/blog/[slug].txt` | raw post (`textformat` matcher) |
| `/[legal].md`, `/[legal].txt` | legal pages (`legal` matcher) |
| `/{icon}.png`, `/favicon.ico`, `/favicon.svg`, `/avatar.{webp,avif}`, `/hero.png` | identity assets, served from the hook |
| `/static/*`, `/fonts/*`, `/logo/*` | proxied to `PUBLIC_CDN_BASE_URL` from the hook |
| `/atom.xml`, `/sitemap.xml`, `/robots.txt`, `/site.webmanifest`, `/llms.txt` | metadata |
| `/pgp.asc` | the active OpenPGP public key, armored (404 when none is published) |
| `/.well-known/openpgpkey/hu/[hash]`, `/.well-known/openpgpkey/policy` | Web Key Directory (WKD) lookup for the active key, and its empty policy file |
| `/.well-known/openapi.{json,yaml}`, `/.well-known/llms.txt`, `/.well-known/api-catalog`, `/.well-known/ard.json`, `/.well-known/agent-skills/index.json`, `/.well-known/agent-skills/[name]/SKILL.md` | discovery ([docs/004-api/001-v1/006-discovery.md](../004-api/001-v1/006-discovery.md)) |

### `/api/ard/**`: public, CORS `*`

| Route              | Method |
| ------------------ | ------ |
| `/api/ard`         | GET    |
| `/api/ard/agents`  | GET    |
| `/api/ard/search`  | POST   |
| `/api/ard/explore` | POST   |

See [docs/004-api/002-ard.md](../004-api/002-ard.md).

### `/api/internal/**`: first-party, same-origin

| Route                                         | Method | Guard                               |
| --------------------------------------------- | ------ | ----------------------------------- |
| `/api/internal/blog/comments`                 | POST   | same-origin, Turnstile, Llama Guard |
| `/api/internal/blog/comments/report`          | POST   | same-origin, Turnstile              |
| `/api/internal/blog/views`                    | POST   | same-origin                         |
| `/api/internal/feedback`                      | POST   | same-origin                         |
| `/api/internal/subscribe`                     | POST   | same-origin, Turnstile              |
| `/api/internal/subscribe/unsubscribe-request` | POST   | same-origin, Turnstile              |
| `/api/internal/contact`                       | POST   | same-origin, Turnstile              |

Details: [004-public-write-endpoints.md](004-public-write-endpoints.md).

## idstead-admin: `admin.example.com`

Pages: `/` (dashboard), `/new`, `/login`. All of them pass the hook's session + MFA guard, except `/login`. Other routes: `/robots.txt` (disallow all) and the identity assets. Blog banners, images and videos are served from the CDN.

API routes authenticate themselves:

- **`blogAdmin`** checks same-origin, then calls `verifyAdminToken`.
- **`requireAdminAuth`** calls `verifyAdminToken` and is used together with a separate `isSameOriginRequest` check.

`verifyAdminToken` requires a Bearer token, `role ∈ {admin, service_role}`, and a satisfied MFA. It returns 401 or 403 otherwise.

| Route | Methods | Guard |
| --- | --- | --- |
| `/api/internal/admin/login` | POST | same-origin, lockout, Turnstile (route + Supabase Auth `captchaToken`) |
| `/api/internal/admin/logout` | POST | same-origin |
| `/api/internal/admin/password` | POST | `blogAdmin` + lockout |
| `/api/internal/admin/posts` | GET, POST | `blogAdmin` |
| `/api/internal/admin/posts/notify` | POST | `blogAdmin` |
| `/api/internal/admin/posts/list` | GET | `blogAdmin`; every post with read time, view and comment counts |
| `/api/internal/admin/posts/draft` | GET | `blogAdmin`; `?id=` returns one post with its markdown for the editor |
| `/api/internal/admin/posts/flags` | POST | `blogAdmin`; `{id, published}` or `{id, pinned}`; publishing queues the newsletter and a render refresh like a save |
| `/api/internal/admin/blog/content-image` | POST | `blogAdmin` |
| `/api/internal/admin/blog/content-video` | POST | `blogAdmin` (WebM only) |
| `/api/internal/admin/activity-log` | GET | `blogAdmin` |
| `/api/internal/admin/activity-log/export` | GET | `blogAdmin` |
| `/api/internal/admin/activity` | GET | `blogAdmin`, called inside `adminActivity()`; `section` is `stats`, `subscribers`, `feedback`, `feedback_history`, `reports` or `report_history` |
| `/api/internal/admin/notifications` | GET, POST | `blogAdmin`, called inside `adminActivity()` |
| `/api/internal/admin/workspace` | GET, POST | `blogAdmin`, called inside `adminWorkspace()` |
| `/api/internal/admin/settings` | GET, PUT | same-origin + `verifyAdminToken` |
| `/api/internal/admin/profile` | GET, POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/profile/import` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/cv` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/cv/generate` | POST | same-origin + `requireAdminAuth`, called inside `processCvGenerate()` |
| `/api/internal/admin/cv/delete` | POST | same-origin + `requireAdminAuth`, called inside `processCvDelete()` |
| `/api/internal/admin/cv/signature` | POST, DELETE | same-origin + `requireAdminAuth`, called inside `processCvSignature()` |
| `/api/internal/admin/openpgp-key` | POST, DELETE | same-origin + `requireAdminAuth`, called inside `processOpenPgpKey()` |
| `/api/internal/admin/author` | GET | same-origin + `requireAdminAuth`; the admin editing snapshot (profile, identity metadata, CV, skills, links, repository rules, CV document, OpenPGP key), or `?part=profile` for the profile alone |
| `/api/internal/admin/legal` | GET, POST | same-origin + `requireAdminAuth`; the privacy, security and terms pages, or `{slug, title, content}` to save one through `db_save_legal` with the admin session |
| `/api/internal/admin/projects` | POST | same-origin + `requireAdminAuth`; `{pinned, excluded}` repository names for the projects section |
| `/api/internal/admin/skills` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/links` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/mdrs-data` | POST | same-origin + `requireAdminAuth`; returns the `author`, `blog` or one `post` live-data tree for the editor preview |
| `/api/internal/admin/comments/reply` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/comments/dismiss-reports` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/data/export` | GET | same-origin + `requireAdminAuth` |
| `/api/internal/admin/data/delete-all` | POST | same-origin + `requireAdminAuth`, password + Turnstile (`captchaToken`), lockout |
| `/api/internal/blog/generate` | POST | same-origin + `requireAdminAuth` (Workers AI summary and TL;DR) |
| `/api/internal/blog/validate-define` | POST | same-origin + `requireAdminAuth`; called by every admin MDRS editor |

## Source

- `apps/api/src/index.ts`
- `apps/web/src/routes/**`, `apps/admin/src/routes/**`
- `packages/lib/src/server/adminAuth.ts`, `blogPostAuth.ts`, `adminCv.ts`, `adminActivity.ts`, `adminWorkspace.ts` (the last two read and write through `AdminActivityStore` from `@idstead/data`)
