# Public REST API (v1)

Public, read-only endpoints at `https://api.fkp.my.id/v1/`. No authentication is required. This document is served live at `GET /v1` as `text/markdown`; send `Accept: application/json` (or `?output=json`) for a JSON index of the endpoints instead. The full machine-readable spec is at `/v1/openapi.json` and `/v1/openapi.yaml` (also mirrored at `https://fkp.my.id/.well-known/openapi.json`).

**Base URL**: `https://api.fkp.my.id`. Every endpoint accepts `GET`, `HEAD` and `OPTIONS` only.

Found a bug or a security issue with this API? See https://fkp.my.id/security for how to report it privately.

```sh
curl https://api.fkp.my.id/v1/blog
```

## Parameters

Every parameter has a full name and a one-letter alias. Use either form, never both for the same parameter.

| Parameter | Alias | Values |
| --- | --- | --- |
| `id` | – | Post ID, unique ID prefix of at least 7 characters, or slug |
| `field` | `f` | `profile`, `contact`, `cv`, `funding`, `skills`, `socials` |
| `output` | `o` | `json`, `md`, `txt`, or a CV file: `pdf`, `sha256`, `sha512`, `md5`, `b2`, `asc`, `sig`, `zip` (each endpoint lists what it offers) |
| `query` | `q` | Search text |
| `page` | `p` | 1-based page number |
| `limit` | `n` | Results per page |
| `checksum` | `c` | `true` or `false` |

- Multi-value parameters (`field`) accept a comma-separated list or a repeated parameter: `?f=profile,cv` and `?f=profile&f=cv` are the same request.
- A parameter an endpoint does not accept returns `400 UNKNOWN_PARAMETER`. Passing a full name together with its alias, or a single-value parameter twice, returns `400 PARAM_CONFLICT`.
- `output` overrides the `Accept` header. Without `output`, `Accept: text/markdown`, `text/plain` or `application/json` picks the representation when the endpoint offers it; otherwise the endpoint default applies.
- Malformed `page`/`limit` values fall back to the default and are clamped to each endpoint's maximum.

## Post IDs

Every post has a stable public ID: 64 lowercase hex characters that never change, even when the post is edited. Wherever a post is referenced, `id` accepts the full ID, any unique prefix of at least 7 characters (like a git commit hash), or the post slug. An exact slug match wins over a prefix match. A prefix shared by several posts returns `409 BLOG_POST_ID_AMBIGUOUS`. Internal database identifiers are never returned.

## Errors

The HTTP status code is authoritative and isn't repeated in the body. Every error response is a nested `error` object, with an `X-Request-ID` header for support/debugging:

```json
{
    "error": {
        "code": "BLOG_POST_NOT_FOUND",
        "message": "Blog post not found.",
        "details": "No published post matches 'this-slug-does-not-exist'."
    }
}
```

- `code` — stable, machine-readable identifier. Safe to `switch`/`case` on.
- `message` — fixed, human-readable description of that error type.
- `details` — optional, request-specific context. Omitted when there's nothing to add.

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `UNKNOWN_PARAMETER` | 400 | The endpoint does not accept one of the query parameters. |
| `PARAM_CONFLICT` | 400 | A parameter was given under its full name and its alias, a single-value parameter was repeated, or `id` was combined with list parameters on `/blog`. |
| `PARAM_INVALID` | 400 | A parameter has a value outside its allowed set (for example `checksum=yes`). |
| `OUTPUT_UNSUPPORTED` | 400 | The endpoint cannot produce the requested `output`. |
| `BLOG_POST_ID_REQUIRED` | 400 | The endpoint needs `id`. |
| `BLOG_POST_ID_INVALID` | 400 | `id` is neither a post ID nor a valid slug. |
| `BLOG_POST_NOT_FOUND` | 404 | No published post matches `id`. |
| `BLOG_POST_ID_AMBIGUOUS` | 409 | The ID prefix matches more than one post. |
| `BLOG_LIST_FETCH_FAILED` | 500 | The post list could not be read. |
| `BLOG_POST_FETCH_FAILED` | 500 | The post could not be read. |
| `BLOG_POST_COUNTS_FETCH_FAILED` | 500 | View or comment counts could not be read. |
| `BLOG_CONTENT_FETCH_FAILED` | 502 | The post body could not be read from storage. |
| `BLOG_COMMENTS_FETCH_FAILED` | 500 | Comments could not be read. |
| `BLOG_VIEWS_FETCH_FAILED` | 500 | View counts could not be read. |
| `AUTHOR_FIELD_INVALID` | 400 | `field` names a section that does not exist. |
| `AUTHOR_FETCH_FAILED` | 500 | Author information could not be read. |
| `CV_CHECKSUM_REQUIRES_PDF` | 400 | `checksum` was given without `output=pdf` or `output=zip`. |
| `CV_METADATA_FETCH_FAILED` | 500 | CV document metadata could not be read. |
| `CV_DOCUMENT_NOT_FOUND` | 404 | No active CV PDF is configured. |
| `CV_SIGNATURE_NOT_FOUND` | 404 | `output=asc` or `output=sig` was requested while the active CV is unsigned. |
| `CV_BUNDLE_NOT_FOUND` | 404 | `output=zip` was requested before the verification bundle was built. |
| `CV_FETCH_FAILED` | 502 | A CV file could not be read from storage. |
| `SEARCH_FETCH_FAILED` | 500 | Search could not be read. |
| `RATE_LIMITED` | 429 | Over the rate limit — see below. |
| `NOT_FOUND` | 404 | No endpoint exists at that path. |
| `METHOD_NOT_ALLOWED` | 405 | Any method other than `GET`, `HEAD` or `OPTIONS`. The `Allow` header lists the accepted methods. |
| `BAD_REQUEST` / `INTERNAL_ERROR` | 400 / 500 | Fallbacks used only if an unexpected framework-level error bypasses the specific codes above. |

## Rate limits

60 requests/minute per IP. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Over the limit returns `429` with `Retry-After`.

## CORS

`Access-Control-Allow-Origin: *` on every response — safe to call from a browser on any origin.

---

## Endpoints

### Blog

| Path | Parameters | Returns |
| --- | --- | --- |
| `/v1/blog` | `query`, `page`, `limit` (default 20, max 100), `output=json\|md` | Published posts, newest first, with `pagination`. |
| `/v1/blog?id=…` | `id`, `output=json\|md\|txt` | One post's metadata plus `comment_count` and `views_count`. Not combinable with list parameters. |
| `/v1/blog/content?id=…` | `id`, `output=md\|txt\|json` (default `md`) | The post body. `json` wraps it as `{id, slug, title, content}`. |
| `/v1/blog/comments` | `id` (optional), `limit` (default 50, max 100) | Approved comments. See below. |
| `/v1/blog/views?id=…` | `id` | `{id, slug, views}`. |

Post metadata is `{id, slug, title, excerpt, summary, tldr, tags, collaborators, created_at, updated_at}`. `excerpt` is written by hand; `summary` and `tldr` are generated when the post is saved and may be `null`/`[]`.

```sh
curl "https://api.fkp.my.id/v1/blog?id=update-gnome-51"
curl "https://api.fkp.my.id/v1/blog/content?id=3f9a1c2&o=txt"
```

#### Comments

Read-only — this API does not accept comment submissions, and only approved comments are returned. Comments carry no identifiers.

- With `id`: `{id, slug, data, hasMore}`. `data` holds the post's threads oldest first; each comment is `{author_name, content, is_admin, is_anonymous, created_at, replies}` with its replies nested in `replies`. `limit` caps the number of top-level threads.
- Without `id`: `{data}` with the newest comments across the site, each `{post: {id, slug}, author_name, content, is_admin, is_anonymous, is_reply, created_at}`.

### Author

| Path | Parameters | Returns |
| --- | --- | --- |
| `/v1/author` | `field` (all sections by default), `output=json\|md` (plus the CV file outputs with `field=cv`), `checksum` | One key per requested section. `profile` includes the public `email` and an optional `pronunciation` (preserved as entered; empty when unset). |
| `/v1/cv` | `output=json\|md\|pdf\|sha256\|sha512\|md5\|b2\|asc\|sig\|zip`, `checksum` | Exactly the same response as `/v1/author?field=cv`, without a redirect. |

When the CV is requested as JSON or Markdown, `cv.document` describes the active PDF (it is `null` when there is no PDF or its metadata cannot be read): `filename`, `version`, `updatedAt`, `checksums` (`sha256`, `sha512`, `md5`, `b2` hex digests), `signature` (`signedAt`, `fingerprint`, `signer` user IDs, or `null` when unsigned), `files` (the API URL of every file below), and `publicKey` (`fingerprint`, the `url` of the armored key, the `wkd` addresses that `gpg --locate-keys` resolves, and `keyservers`).

The CV file outputs are available only when the request is for the CV alone (`/v1/cv`, or `/v1/author` with `field=cv`). Each downloads one file as an attachment, named so that it sits next to the PDF:

| `output` | File | Content type |
| --- | --- | --- |
| `pdf` | `{file}.pdf` | `application/pdf` |
| `sha256`, `sha512`, `md5`, `b2` | `{file}.pdf.{output}` in coreutils format (`b2` is BLAKE2b-512) | `text/plain` |
| `asc` | `{file}.pdf.asc`, the ASCII-armored detached OpenPGP signature | `application/pgp-signature` |
| `sig` | `{file}.pdf.sig`, the same signature in binary form | `application/octet-stream` |
| `zip` | `{file}-verify.zip`: the PDF, its checksum files, both signatures, `publickey.asc` and `VERIFY.txt` | `application/zip` |

`checksum` applies to `pdf` and `zip` and defaults to `true`, which adds `Repr-Digest: sha-256=:<base64>:, sha-512=:<base64>:` (RFC 9530) and `X-Checksum-SHA256: <hex>`. Send `Want-Repr-Digest` (for example `sha-512=10, sha-256=1`) to narrow or order the algorithms. `checksum=false` downloads the file without these headers, and `checksum` with any other output returns `400 CV_CHECKSUM_REQUIRES_PDF`.

The signature is verified against the active OpenPGP key when it is uploaded. Fetch that key from a source other than the bundle: `https://fkp.my.id/pgp.asc`, WKD (`gpg --locate-keys` with an address listed in `publicKey.wkd`), or a keyserver in `publicKey.keyservers`.

```sh
curl "https://api.fkp.my.id/v1/author?f=profile,skills&o=md"
curl -OJ "https://api.fkp.my.id/v1/cv?o=pdf"
curl -OJ "https://api.fkp.my.id/v1/cv?o=sha256" && sha256sum -c CV-*.pdf.sha256
curl -OJ "https://api.fkp.my.id/v1/cv?o=sig" && gpg --verify CV-*.pdf.sig
```

### Search

| Path | Parameters | Returns |
| --- | --- | --- |
| `/v1/search` | `query` (min 2 chars), `page`, `limit` (default 6, max 20) | `{query, data, pagination: {page, limit, returned, hasMore}}` |

Each result is `{type: "post", id, title, subtitle, url}`. A query under two characters returns an empty result, not an error. Page until `hasMore` is `false`.

### Discovery

| Path               | Returns                                                    |
| ------------------ | ---------------------------------------------------------- |
| `/v1`              | This document (`text/markdown`), or a JSON endpoint index. |
| `/v1/openapi.json` | OpenAPI 3 specification, JSON.                             |
| `/v1/openapi.yaml` | Same specification, YAML.                                  |

Also available for AI/LLM agents on `https://fkp.my.id`: `/llms.txt`, `/.well-known/agent-skills/index.json` (per-endpoint agent skill descriptors with content digests), and `/.well-known/api-catalog` (RFC 9727 linkset).

---

## Caching

Public JSON and text responses provide ETags. Send `If-None-Match` to revalidate; unchanged representations return `304` with no body. Responses include `Vary: Accept`, and query parameters are part of the cache key. Mutable data uses a maximum shared-cache lifetime of 60 seconds. Errors are not cached.

The agent discovery index is a site-specific JSON document containing `skills`. Each entry has `name`, `type: "skill-md"`, `description`, `url`, and `digest`. URLs resolve to Markdown SKILL.md documents. Digests are SHA-256 of the exact UTF-8 document bytes.

Production robots policy permits search and AI input while declaring AI training disallowed. These crawler signals express policy, not access control. Preview deployments and internal pages advertise noindex.
