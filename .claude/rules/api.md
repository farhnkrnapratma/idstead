---
paths:
    - apps/api/**
    - packages/lib/src/server/api/**
    - packages/lib/src/openapi.ts
    - docs/004-api/**
---

# Public API (`apps/api`)

Full endpoint reference and error-code table: [apps/api/src/README.md](../../apps/api/src/README.md) — served live at `GET /v1`, with `{{API_BASE_URL}}` and `{{SITE_URL}}` filled from the request origin and the profile's site URL by `renderReadme()`. Read it before adding/changing any API route. `apps/api/src/index.ts` is a Hono app; endpoint logic lives in `packages/lib/src/server/api/` (`blog.ts`, `author.ts`, `root.ts`) and routes only wrap it in `runApi()`. Key conventions:

- **Error envelope**: handlers return a flat `{code, message, details?}` body via `apiError()` or throw `ApiRequestError`; the worker middleware wraps it with `apiErrorEnvelope()` into the public `{error: {...}}` shape. Never hand-roll error JSON.
- **Error codes** are stable and per-endpoint (e.g. `BLOG_POST_NOT_FOUND`) — add new codes to both the handler and the README table.
- **Versioning**: breaking changes ship under a new `/v2/`, never in place under `/v1`. The October 2026 v1 reshape and move to the `api.` host were one-time exceptions; don't treat them as precedent.
- **Read-only**: the API worker answers `GET`/`HEAD`/`OPTIONS` only (`405` otherwise). Anything that writes data lives under `/api/internal/**` on web or admin — unversioned, undocumented, first-party-only, gated by `isSameOriginRequest()` where there's no other auth.
- **CORS, rate limiting (60 req/min/IP via `API_RATE_LIMITER`, in-memory fallback), ETags and `Vary: Accept`** are handled centrally in the worker middleware.
- **Parameters**: parse every query string with `parseApiParams(url, allowed)` (`server/api/params.ts`). Full names and one-letter aliases: `field`/`f`, `output`/`o`, `query`/`q`, `page`/`p`, `limit`/`n`, `checksum`/`c`; `id` has none. Unknown parameters → `400 UNKNOWN_PARAMETER`; name+alias together → `400 PARAM_CONFLICT`. Single resources use `?id=`, never a path segment.
- **Representations**: JSON by default except `GET /v1` and `/v1/blog/content` (markdown). `output` (via `resolveOutput`) overrides `Accept`. `/v1/resume` must stay byte-identical to `/v1/author?field=resume`.
- **No database IDs in public output**: posts are identified by `db_posts.public_id` (64 hex, immutable), resolved with `BlogRepository.findPublished()` (full ID, slug, or unique ≥7-char prefix), and comments by `db_comments.public_id`. Never return UUIDs or `*_id` columns from the API, page data, feeds, or banner URLs.
- Keep `packages/lib/src/openapi.ts` (paths are `/v1/...`) in sync with any route/schema change; the worker serves it at `/v1/openapi.{json,yaml}` and web mirrors it at `/.well-known/openapi.{json,yaml}`.
