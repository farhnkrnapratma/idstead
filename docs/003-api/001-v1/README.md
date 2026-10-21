# API v1

- **Base URL:** `https://api.example.com/v1`
- **Authentication:** none
- **Methods:** `GET`, `HEAD`, `OPTIONS`

```sh
curl https://api.example.com/v1/blog
```

## Pages

| Page | Covers |
| --- | --- |
| [parameters.md](001-parameters.md) | Query parameters, aliases, output negotiation, post IDs |
| [errors.md](002-errors.md) | Error envelope and every v1 error code |
| [blog.md](003-blog.md) | `/v1/blog`, `/v1/blog/content`, `/v1/blog/comments`, `/v1/blog/views` |
| [author.md](004-author.md) | `/v1/author`, `/v1/cv` |
| [search.md](005-search.md) | `/v1/search` |
| [discovery.md](006-discovery.md) | `/v1`, OpenAPI, `.well-known`, `llms.txt`, agent skills |

## Endpoints

| Method | Path | Default output | Other outputs |
| --- | --- | --- | --- |
| GET | `/v1` | `md` | `json` |
| GET | `/v1/blog` | `json` | `md`, plus `txt` with `?id=` |
| GET | `/v1/blog/content?id=` | `md` | `txt`, `json` |
| GET | `/v1/blog/comments` | `json` | – |
| GET | `/v1/blog/views?id=` | `json` | – |
| GET | `/v1/author` | `json` | `md`, plus `pdf` with `field=cv` only |
| GET | `/v1/cv` | `json` | `md`, `pdf` |
| GET | `/v1/search` | `json` | – |
| GET | `/v1/openapi.json`, `/v1/openapi.yaml` | spec | – |

Outside `/v1`, `GET /` redirects 301 to `/v1`, and `GET /robots.txt` returns `User-agent: * / Allow: /`.

## Behaviour on every response

**Methods**

- `GET` and `HEAD` are served. `HEAD` returns the same headers with no body.
- `OPTIONS` returns `204` before rate limiting, with:
    - `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
    - `Access-Control-Allow-Headers: Content-Type, Authorization, If-None-Match`
    - `Access-Control-Max-Age: 86400`
- Any other method returns `405 METHOD_NOT_ALLOWED` with `Allow: GET, HEAD, OPTIONS`.

**Rate limit**

- 60 requests per 60 seconds per client IP, shared across every path on the host (404s and `/v1/openapi.*` included).
- The client IP is taken from `cf-connecting-ip`, then the first `x-forwarded-for` entry.
- Every response that passed the limiter carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (Unix seconds).
- Over the limit returns `429 RATE_LIMITED` with `Retry-After` (seconds). The limiter runs before the method check, so an over-limit `POST` gets `429`, not `405`.

**CORS**

- `Access-Control-Allow-Origin: *`.
- `Access-Control-Expose-Headers: ETag, Link, X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-Checksum-SHA256, Repr-Digest, Content-Disposition`.

**Tracing:** `X-Request-ID` echoes the request's `X-Request-ID`, or holds a fresh UUID. Quote it when reporting a problem.

**Caching**

- Successful responses send `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate`. The OpenAPI files use `s-maxage=300`.
- Every `200` except a PDF gets a strong `ETag`: the SHA-256 of the body.
- `If-None-Match` accepts lists, `W/` and `*`. A match returns `304` with no body.
- `Vary: Accept` is always set, and query parameters are part of the cache key.

**Errors:** every `4xx`/`5xx` uses the [error envelope](002-errors.md) with `Cache-Control: no-store`.

**Indexing:** `X-Robots-Tag: index, follow` on handler responses, and `noindex, nofollow` on preview hosts (`*.workers.dev`).

## Data rules

- Only **published** posts and **approved** comments are visible.
- Internal database identifiers (UUIDs, `*_id` columns) are never returned. Posts are identified by their 64-hex `public_id`, returned as `id` (see [parameters.md](001-parameters.md#post-ids)).
- The API never writes. Comment submission, view counting and subscriptions are first-party endpoints on `example.com` and are not part of this API.

## Reporting problems

Report security issues privately through [SECURITY.md](../../../SECURITY.md). Do not open a public issue for them.
