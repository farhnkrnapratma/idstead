# 10. Endpoint Reference

Every route on the three hosts that serve traffic, with its guard. The lists were generated from the route files on 2026-10-15. To regenerate them:

```sh
rg -n "export const (GET|POST|PUT|DELETE|PATCH)" apps/web/src/routes apps/admin/src/routes -g '+server.ts'
rg --files --hidden apps/web/src/routes/.well-known
rg -n "^app\.get" apps/api/src/index.ts
```

## fkp-api: `api.fkp.my.id` (public, read-only)

All routes are `GET`/`HEAD` (`OPTIONS` returns 204), rate-limited to 60 requests per minute per IP, use the anon client, and are CORS `*`. Full reference: [docs/api/v1](../api/v1/README.md).

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

## fkp-web: `fkp.my.id`

### Pages

`/`, `/blog`, `/blog/[slug]`, `/feedback`, `/privacy`, `/terms`, `/security`, `/subscribe/confirm`, `/unsubscribe`. These are server loads with the anon client, except that the subscribe/unsubscribe pages use service-role. `/projects`, `/contact`, `/cv`, `/funding` and `/home` redirect 307 to `/#section`.

### Files and feeds (GET)

| Route | Notes |
| --- | --- |
| `/blog/[slug].md`, `/blog/[slug].txt` | raw post (`textformat` matcher) |
| `/[legal].md`, `/[legal].txt` | legal pages (`legal` matcher) |
| `/blog/banners/[file]` | `serveBlogBanner` (R2) |
| `/blog/content/[file]` | `getContentAsset` (R2, content-addressed) |
| `/{icon}.png`, `/favicon.ico`, `/favicon.svg`, `/avatar.{webp,avif}`, `/hero.png` | identity assets, served from the hook |
| `/static/*`, `/fonts/*`, `/logo/*` | proxied to `PUBLIC_CDN_BASE_URL` from the hook |
| `/atom.xml`, `/sitemap.xml`, `/robots.txt`, `/site.webmanifest`, `/llms.txt` | metadata |
| `/.well-known/openapi.{json,yaml}`, `/.well-known/llms.txt`, `/.well-known/api-catalog`, `/.well-known/ard.json`, `/.well-known/agent-skills/index.json`, `/.well-known/agent-skills/[name]/SKILL.md` | discovery ([docs/api/v1/discovery.md](../api/v1/discovery.md)) |

### `/api/ard/**`: public, CORS `*`

| Route              | Method |
| ------------------ | ------ |
| `/api/ard`         | GET    |
| `/api/ard/agents`  | GET    |
| `/api/ard/search`  | POST   |
| `/api/ard/explore` | POST   |

See [docs/api/ard.md](../api/ard.md).

### `/api/internal/**`: first-party, same-origin

| Route                                         | Method | Guard                               |
| --------------------------------------------- | ------ | ----------------------------------- |
| `/api/internal/blog/comments`                 | POST   | same-origin, Turnstile, Llama Guard |
| `/api/internal/blog/comments/report`          | POST   | same-origin, Turnstile              |
| `/api/internal/blog/views`                    | POST   | same-origin                         |
| `/api/internal/blog/feedback`                 | POST   | same-origin (legacy body)           |
| `/api/internal/feedback`                      | POST   | same-origin                         |
| `/api/internal/subscribe`                     | POST   | same-origin, Turnstile              |
| `/api/internal/subscribe/unsubscribe-request` | POST   | same-origin, Turnstile              |
| `/api/internal/subscribe/unsubscribe`         | POST   | 64-hex token                        |
| `/api/internal/contact`                       | POST   | same-origin, Turnstile              |

Details: [4-public-write-endpoints.md](4-public-write-endpoints.md).

## fkp-admin: `admin.fkp.my.id`

Pages: `/` (dashboard), `/new`, `/login`. All of them pass the hook's session + MFA guard, except `/login`. Other routes: `/robots.txt` (disallow all), `/blog/banners/[file]`, and the identity assets.

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
| `/api/internal/admin/posts/cleanup` | POST | `blogAdmin` |
| `/api/internal/admin/blog/content-image` | POST | `blogAdmin` |
| `/api/internal/admin/blog/content-video` | POST | `blogAdmin` |
| `/api/internal/admin/activity-log` | GET | `blogAdmin` |
| `/api/internal/admin/activity-log/export` | GET | `blogAdmin` |
| `/api/internal/admin/activity` | GET | `blogAdmin`, called inside `adminActivity()` |
| `/api/internal/admin/notifications` | GET, POST | `blogAdmin`, called inside `adminActivity()` |
| `/api/internal/admin/workspace` | GET, POST | `blogAdmin`, called inside `adminWorkspace()` |
| `/api/internal/admin/settings` | GET, PUT | same-origin + `verifyAdminToken` |
| `/api/internal/admin/profile` | GET, POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/profile/import` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/profile/cleanup` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/cv` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/cv/generate` | POST | same-origin + `requireAdminAuth`, called inside `processCvGenerate()` |
| `/api/internal/admin/cv/upload` | POST | same as `cv/generate` (it delegates to `processCvGenerate`) |
| `/api/internal/admin/cv/delete` | POST | same-origin + `requireAdminAuth`, called inside `processCvDelete()` |
| `/api/internal/admin/skills` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/links` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/comments/reply` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/comments/dismiss-reports` | POST | same-origin + `requireAdminAuth` |
| `/api/internal/admin/data/export` | GET | same-origin + `requireAdminAuth` |
| `/api/internal/admin/data/delete-all` | POST | same-origin + `requireAdminAuth`, password + Turnstile (`captchaToken`), lockout |
| `/api/internal/blog/generate` | POST | same-origin + `requireAdminAuth` (Workers AI summary and TL;DR) |
| `/api/internal/blog/validate-define` | POST | same-origin + `requireAdminAuth` |

## Source

- `apps/api/src/index.ts`
- `apps/web/src/routes/**`, `apps/admin/src/routes/**`
- `packages/lib/src/server/adminAuth.ts`, `blogPostAuth.ts`, `adminCv.ts`, `adminActivity.ts`, `adminWorkspace.ts`
