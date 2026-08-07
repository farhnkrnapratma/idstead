<!-- @format -->

# fkp.my.id — Public REST API (v1)

Public, read-only endpoints (plus comments/views) for fkp.my.id, served under `/api/v1/`. No authentication required for anything below. This document is also served live at `GET /api/v1` as `text/markdown`. Full machine-readable spec: `/.well-known/openapi.json` / `/.well-known/openapi.yaml`.

**Base URL**: `https://fkp.my.id`. Versioned by URL path — breaking changes ship under `/api/v2/`, not in place.

Found a bug or a security issue with this API? See `SECURITY.md` in the repo root for how to report it privately — please don't open a public issue for a suspected vulnerability.

```sh
curl https://fkp.my.id/api/v1/blog
```

## Errors

The HTTP status code is authoritative and isn't repeated in the body. Every error response is a nested `error` object, with an `X-Request-ID` header for support/debugging:

```json
{
  "error": {
    "code": "BLOG_POST_NOT_FOUND",
    "message": "Blog post not found",
    "details": "No blog post exists with slug 'this-slug-does-not-exist-12345'."
  }
}
```

- `code` — stable, machine-readable identifier. Safe to `switch`/`case` on; never changes without a version bump.
- `message` — fixed, human-readable description of that error type. Same wording for every occurrence of a given `code`.
- `details` — optional, request-specific context (which field, which value). Omitted when there's nothing beyond `message` to add.

This shape is enforced by one shared handler for the whole API, so it's the same for every endpoint below.

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `BLOG_LIST_FETCH_FAILED` | 500 | `/api/v1/blog` couldn't query the database. |
| `BLOG_POST_NOT_FOUND` | 404 | No published post matches the given ID/slug. |
| `BLOG_COMMENT_INVALID_POST_ID` | 400 | `postId` was given but isn't a valid UUID. |
| `BLOG_COMMENTS_FETCH_FAILED` | 500 | `/api/v1/blog/comments` (GET) couldn't query the database. |
| `BLOG_COMMENT_INVALID_PARENT_ID` | 400 | `parentId` isn't a valid UUID. |
| `BLOG_COMMENT_CONTENT_REQUIRED` | 400 | `content` is missing or empty. |
| `BLOG_COMMENT_CONTENT_TOO_LONG` | 400 | `content` exceeds 2000 characters. |
| `BLOG_COMMENT_AUTHOR_NAME_REQUIRED` | 400 | `authorName` is missing and `isAnonymous` isn't `true`. |
| `BLOG_COMMENT_AUTHOR_NAME_RESERVED` | 400 | `authorName` is a reserved/disallowed name. |
| `BLOG_COMMENT_TURNSTILE_FAILED` | 403 | Missing or invalid `turnstileToken`. |
| `BLOG_COMMENT_SAVE_FAILED` | 500 | The comment passed validation but couldn't be saved. |
| `BLOG_VIEW_POST_ID_REQUIRED` | 400 | `postId` is missing (GET query or POST body). |
| `BLOG_VIEW_TRACKING_FAILED` | 500 | `/api/v1/blog/views` (POST) hit an unexpected error. |
| `CV_DOCUMENT_NOT_FOUND` | 404 | `/api/v1/cv` — no active CV document is configured. |
| `INVALID_JSON_BODY` | 400 | The request body isn't valid JSON. |
| `RATE_LIMITED` | 429 | Over the rate limit — see below. |
| `NOT_FOUND` | 404 | Generic fallback — hit a path that doesn't correspond to any endpoint. |
| `BAD_REQUEST` / `UNAUTHORIZED` / `FORBIDDEN` / `INTERNAL_ERROR` | 400 / 401 / 403 / 500 | Generic fallback codes used only if an unexpected framework-level error bypasses one of the specific codes above — every endpoint documented here returns a specific code instead. |

## Rate limits

60 requests/minute per IP, enforced globally. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Over the limit returns `429` with `Retry-After`.

## CORS

`Access-Control-Allow-Origin: *` on every response — safe to call from a browser on any origin.

---

## Endpoints

### Blog

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/blog` | List published posts. Query: `q`, `id`, `slug`, `page`, `limit` (max 100, default 20), `format=md`. |
| GET | `/api/v1/blog/{id_or_slug}` | Single post by UUID or slug. Query: `format=md`. `404` if no matching published post. |
| GET | `/api/v1/blog/comments` | Approved comments. Query: `postId` (UUID; alias `post_id` also accepted — omit for recent site-wide), `limit` (max 100, default 50). `400` if `postId` is present but not a valid UUID. |
| POST | `/api/v1/blog/comments` | Submit a comment. Body: `{postId, content, turnstileToken, authorName?, isAnonymous?, parentId?}`. `authorName` required unless `isAnonymous` is `true`. Returns `201`. |
| GET | `/api/v1/blog/views` | View count for a post. Query: `postId` (required). |
| POST | `/api/v1/blog/views` | Record a view. Body: `{postId}`. Deduplicated per IP per day — `201` with `{"counted": true}` if newly recorded, `200` with `{"counted": false}` if already counted today. |

#### Comments

`turnstileToken` is required on `POST` — a Cloudflare Turnstile response token from the widget on the comment form, verified server-side via siteverify. Requests with a missing or invalid token get `403`. Every submission that passes is also AI-moderated (Llama Guard 3, with a heuristic keyword/pattern fallback if the AI binding is unavailable). `is_approved: false` in the response means the comment was held back, not published — `GET` only ever returns approved comments.

```sh
curl -X POST https://fkp.my.id/api/v1/blog/comments \
  -H "Content-Type: application/json" \
  -d '{"postId": "<uuid>", "content": "Great post!", "authorName": "Jane", "turnstileToken": "<token>"}'
```

```json
{
  "is_approved": true,
  "comment": {
    "id": "...",
    "post_id": "...",
    "parent_id": null,
    "author_name": "Jane",
    "content": "Great post!",
    "is_anonymous": false,
    "is_approved": true,
    "created_at": "..."
  },
  "moderation": {"engine": "llama-guard-3", "categories": []}
}
```

`GET` returns `{"data": [...]}`, each comment shaped like the `comment` object above. This endpoint does not paginate — it's capped by `limit`, no `pagination` object.

#### Views

`POST` does not require `turnstileToken` — only `postId` is validated (any non-empty string, not checked against the UUID format that `comments` enforces).

```sh
curl -X POST https://fkp.my.id/api/v1/blog/views \
  -H "Content-Type: application/json" \
  -d '{"postId": "<uuid>"}'
```

```json
{"counted": true}
```

```sh
curl "https://fkp.my.id/api/v1/blog/views?postId=<uuid>"
```

```json
{"postId": "<uuid>", "views": 42}
```

### Author

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/author` | Combined profile. Query: `fields` (comma-separated subset of `profile,cv,funding,contact,skills,socials`, defaults to all — a bare `?profile`, `?cv`, etc. flag also works, and `?sponsorship` is an alias for `funding`), `format=md`. |
| GET | `/api/v1/author/contact` | Contact info. |
| GET | `/api/v1/author/socials` | Social links. |
| GET | `/api/v1/author/skills` | Skills grouped by category. |
| GET | `/api/v1/author/funding` | Funding/sponsorship links. |
| GET | `/api/v1/author/cv` | Structured CV (experience + education) as JSON. |
| GET | `/api/v1/cv` | CV as `application/pdf`. |

The per-field sub-routes (`contact`, `socials`, `skills`, `funding`, `cv`) don't support `format=md` — that's only available on the combined `/api/v1/author` endpoint.

### Search

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/search` | Search blog posts by title/excerpt. Query: `q` (min 2 chars, returns an empty result below that — not a `400`), `limit` (max 20, default 6). |

Response shape is `{query, data, pagination: {limit, returned}}` — lighter than the `/api/v1/blog` pagination object below, and no separate `page` param (single page of up to `limit` results).

### Discovery & machine-readable docs

| Method | Path                   | Description                     |
| ------ | ---------------------- | ------------------------------- |
| GET    | `/api/v1/openapi.json` | OpenAPI v3 specification, JSON. |
| GET    | `/api/v1/openapi.yaml` | Same spec, YAML.                |

These mirror the canonical copies at `/.well-known/openapi.json` / `/.well-known/openapi.yaml` — prefer the `.well-known` paths for new integrations. Also available for AI/LLM agents: `/llms.txt` (structured directory of every public doc/API/feed), `/.well-known/agent-skills/index.json` (per-endpoint agent skill descriptors with content digests), and `/.well-known/api-catalog` (RFC 9727 linkset).

---

## Pagination

`/api/v1/blog` returns `data` plus a `pagination` object: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`. `/api/v1/search` uses the lighter `{limit, returned}` shape noted above. `/api/v1/blog/comments` doesn't paginate at all — it's a flat list capped by `limit`.

## Markdown responses

Add `?format=md` (or send `Accept: text/markdown`) for a markdown response instead of JSON. Supported on `/api/v1/blog`, `/api/v1/blog/{id_or_slug}`, and `/api/v1/author` only — not on the author sub-routes, `blog/comments`, `blog/views`, or `search`.
