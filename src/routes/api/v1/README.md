# Public REST API (v1)

Public, read-only endpoints documentation served under `/api/v1/`. No authentication required for anything below. This document is also served live at `GET /api/v1/docs` as `text/markdown` (`GET /api/v1` redirects there). Full machine-readable spec: `/.well-known/openapi.json` / `/.well-known/openapi.yaml`.

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
| `BLOG_INVALID_LANG` | 400 | `lang` was given but isn't one of `id`, `ja`, `zh`, `ko`. |
| `BLOG_COMMENT_INVALID_POST_ID` | 400 | `postId` was given but isn't a valid UUID. |
| `BLOG_COMMENTS_FETCH_FAILED` | 500 | `/api/v1/blog/comments` couldn't query the database. |
| `BLOG_VIEW_POST_ID_REQUIRED` | 400 | `postId` query parameter is missing. |
| `BLOG_VIEW_INVALID_POST_ID` | 400 | `postId` query parameter is not a valid UUID. |
| `CV_DOCUMENT_NOT_FOUND` | 404 | `/api/v1/cv` — no active CV document is configured. |
| `CV_FETCH_FAILED` | 502 | `/api/v1/cv` couldn't fetch the underlying PDF file from storage. |
| `SEARCH_INVALID_OFFSET` | 400 | `offset` was given but isn't a non-negative integer. |
| `SEARCH_FETCH_FAILED` | 500 | Search could not be read from the data source. |
| `BLOG_POST_COUNTS_FETCH_FAILED` | 500 | Post comment/view counts could not be read. |
| `BLOG_CONTENT_FETCH_FAILED` | 502 | Published post content could not be read from storage. |
| `BLOG_POST_FETCH_FAILED` | 500 | Blog post could not be read from the data source. |
| `BLOG_VIEWS_FETCH_FAILED` | 500 | View counts could not be read from the data source. |
| `AUTHOR_FETCH_FAILED` | 500 | Combined author information could not be read from the data source. |
| `AUTHOR_CONTACT_FETCH_FAILED` | 500 | Contact could not be read from the data source. |
| `AUTHOR_CV_FETCH_FAILED` | 500 | Structured CV could not be read from the data source. |
| `AUTHOR_SKILLS_FETCH_FAILED` | 500 | Skills could not be read from the data source. |
| `AUTHOR_FUNDING_FETCH_FAILED` | 500 | Funding could not be read from the data source. |
| `AUTHOR_SOCIALS_FETCH_FAILED` | 500 | Social links could not be read from the data source. |
| `CV_METADATA_FETCH_FAILED` | 500 | CV document metadata could not be read from the data source. |
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
| GET | `/api/v1/blog` | List published posts. Query: `q`, `id`, `slug`, `page`, `limit` (max 100, default 20), `format=md`, `lang`. |
| GET | `/api/v1/blog/{id_or_slug}` | Single post by UUID or slug. Query: `format=md`\|`text`, `lang`. `404` if no matching published post. |
| GET | `/api/v1/blog/comments` | Approved comments. Query: `postId` (UUID; alias `post_id` also accepted — omit for recent site-wide), `limit` (max 100, default 50). `400` if `postId` is present but not a valid UUID. |
| GET | `/api/v1/blog/views` | View count for a post. Query: `postId` (required). |

Both `/api/v1/blog` list items and the `/api/v1/blog/{id_or_slug}` detail response include a `collaborators` field (array of collaborator names/handles).

Both also include `excerpt` (short teaser, nullable string), `summary` (longer AI-generated recap, nullable string), and `tldr` (AI-generated key points, nullable array of up to 4 strings). All three are generated automatically at publish/edit time — a post may have `null`/`[]` for `summary`/`tldr` if it predates this feature or generation failed; this is expected, not an error. These fields are also included in `?format=md`/`?format=text` output alongside the raw excerpt blockquote.

#### Translations (`lang`)

Add `?lang=` with one of `id` (Indonesian), `ja` (Japanese), `zh` (Simplified Chinese) or `ko` (Korean) to get an AI-translated version of `title`, `excerpt`, `summary`, `tldr`, and (on the detail endpoint) `content`. Translations are generated automatically when a post is published — there is no on-demand translation endpoint.

Every response (list items and the detail endpoint) includes:

- `language` — the language actually returned (`en`, `id`, `ja`, `zh` or `ko`). May differ from the requested `lang`.
- `requested_language` — the `lang` value that was requested, or `null` if none was given.
- `machine_translated` — `true` when `language` isn't `en`.
- `translation_disclaimer` — present only when `machine_translated` is `true`: a warning that the content was translated by AI and may contain errors, in the same language as `language`.

If a translation hasn't been generated yet for the requested language, the response falls back to English (`language: "en"`, `machine_translated: false`) — **this is a `200`, never a `404`**. An unrecognized `lang` value (not `id`, `ja`, `zh` or `ko`) returns `400 BLOG_INVALID_LANG`. The disclaimer is also prepended to `?format=md`/`?format=text` output when the response is a translation — on `?format=md` it's a real `:::note` callout block, matching how callouts render elsewhere in the article.

#### Comments

Read-only — this API does not accept comment submissions. `GET` returns `{"data": [...]}`, each comment shaped as `{id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at}`; only approved comments are ever returned. Site-wide results are newest first; a post thread is oldest first. This endpoint does not paginate — it's capped by `limit`, no `pagination` object.

```sh
curl "https://fkp.my.id/api/v1/blog/comments?postId=<uuid>"
```

#### Views

Read-only — this API does not record views.

```sh
curl "https://fkp.my.id/api/v1/blog/views?postId=<uuid>"
```

```json
{"postId": "<uuid>", "views": 42}
```

### Author

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/author` | Combined profile. `profile` includes the public `email` field and an optional `pronunciation` field (preserved as entered, including any slashes or brackets; empty when unset). Query: `fields` (comma-separated subset of `profile,cv,funding,contact,skills,socials`, defaults to all — a bare `?profile`, `?cv`, etc. flag also works, and `?sponsorship` is an alias for `funding`), `format=md`. |
| GET | `/api/v1/author/contact` | Contact info. |
| GET | `/api/v1/author/socials` | Social links. |
| GET | `/api/v1/author/skills` | Skills grouped by category. |
| GET | `/api/v1/author/funding` | Funding/sponsorship links. |
| GET | `/api/v1/author/cv` | Structured CV (experience + education) as JSON. |
| GET | `/api/v1/cv` | CV as `application/pdf`. Query: `download=1` forces `Content-Disposition: attachment` (default `inline`); `format=sha256` (alias `checksum=1`) returns a `text/plain` SHA-256 checksum sidecar instead of the PDF. Response includes an `X-Checksum-SHA256` header either way. |

The per-field sub-routes (`contact`, `socials`, `skills`, `funding`, `cv`) don't support `format=md` — that's only available on the combined `/api/v1/author` endpoint.

### Search

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/search` | Search blog posts by title/excerpt. Query: `q` (min 2 chars, returns an empty result below that — not a `400`), `limit` (max 20, default 6), `offset` (non-negative integer, default 0; `400 SEARCH_INVALID_OFFSET` otherwise). |

Response shape is `{query, data, pagination: {limit, returned}}` — lighter than the `/api/v1/blog` pagination object below, and no separate `page` param (single page of up to `limit` results).

### Discovery & machine-readable docs

| Method | Path                   | Description                     |
| ------ | ---------------------- | ------------------------------- |
| GET    | `/api/v1/docs`         | This document, `text/markdown`. |
| GET    | `/api/v1/openapi.json` | OpenAPI v3 specification, JSON. |
| GET    | `/api/v1/openapi.yaml` | Same spec, YAML.                |

These mirror the canonical copies at `/.well-known/openapi.json` / `/.well-known/openapi.yaml` — prefer the `.well-known` paths for new integrations. Also available for AI/LLM agents: `/llms.txt` (structured directory of every public doc/API/feed), `/.well-known/agent-skills/index.json` (per-endpoint agent skill descriptors with content digests), and `/.well-known/api-catalog` (RFC 9727 linkset).

---

## Pagination

`/api/v1/blog` returns `data` plus a `pagination` object: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`. `/api/v1/search` uses the lighter `{limit, offset, returned, hasMore}` shape: page with `offset` and stop when `hasMore` is `false`. `/api/v1/blog/comments` doesn't paginate at all — it's a flat list capped by `limit`.

## Markdown responses

Add `?format=md` (or send `Accept: text/markdown`) for a markdown response instead of JSON. Supported on `/api/v1/blog`, `/api/v1/blog/{id_or_slug}`, and `/api/v1/author` only — not on the author sub-routes, `blog/comments`, `blog/views`, or `search`.

`/api/v1/blog/{id_or_slug}` additionally supports `?format=text` (alias `txt`, or `Accept: text/plain`) for a genuine plain-text rendering, distinct from `format=md`. Note `/api/v1/author`'s `?format=text` behaves differently — it's treated as an alias for markdown there, not plain text.

## Caching and discovery

Public JSON and text responses provide ETags. Send `If-None-Match` to revalidate; unchanged representations return `304` with no body. Negotiated responses include `Vary: Accept`, and query parameters remain part of the cache key. Mutable API data uses a maximum shared-cache lifetime of 60 seconds. Errors are not cached. GET routes also support HEAD; public preflight advertises GET, HEAD, and OPTIONS.

Malformed numeric limits fall back to the documented default, and numeric limits are clamped to each endpoint's maximum. Data-source failures return endpoint-specific errors instead of empty successful responses.

The agent discovery index is a site-specific JSON document containing `skills`. Each entry has `name`, `type: "skill-md"`, `description`, `url`, and `digest`. URLs resolve to Markdown SKILL.md documents. Digests are SHA-256 of the exact UTF-8 document bytes. The index does not claim conformance to an unverified external discovery schema.

`/site.webmanifest` is generated from the public profile and app appearance settings. Avatar/icon files are stored in R2, while their metadata and active version are stored in Supabase. Image uploads use authenticated internal endpoints and are not part of this public API.

Production robots policy permits search and AI input while declaring AI training disallowed. These crawler signals express policy, not access control. Preview deployments and admin/internal pages advertise noindex.
