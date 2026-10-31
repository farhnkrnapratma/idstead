# v1 Errors

## Envelope

Every error response, at any `4xx` or `5xx` status, has the same shape:

```json
{
    "error": {
        "code": "BLOG_POST_NOT_FOUND",
        "message": "Blog post not found.",
        "details": "No published post matches 'this-slug-does-not-exist'."
    }
}
```

- `code` is stable and machine-readable. Branch on it.
- `message` is a fixed, human-readable description of the code.
- `details` gives request-specific context. It is **omitted** when there is nothing to add; it is never `null`.
- The HTTP status is authoritative and is not repeated in the body.

Error responses carry:

- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store`
- `X-Request-ID`
- `Access-Control-Allow-Origin: *`
- `Access-Control-Expose-Headers: X-Request-ID, Retry-After`
- the rate-limit headers
- `Allow` on `405`

How it is built:

- Handlers return a flat `{code, message, details?}` through `apiError()`, or throw `ApiRequestError`.
- The worker middleware wraps that into the envelope with `apiErrorEnvelope()` (`packages/lib/src/server/apiEnvelope.ts`).
- Messages that leak database internals (PostgREST, RLS, column names) are replaced with a generic message, and their `details` are dropped.

## Codes

| Code | Status | When |
| --- | --- | --- |
| `UNKNOWN_PARAMETER` | 400 | A query key is not accepted by the endpoint. |
| `PARAM_CONFLICT` | 400 | A name and its alias are both given, a single-value parameter is repeated, or `id` is combined with `query`, `page` or `limit` on `/v1/blog`. |
| `PARAM_INVALID` | 400 | A value is outside its allowed set (`checksum` must be `true` or `false`). |
| `OUTPUT_UNSUPPORTED` | 400 | The endpoint cannot produce the requested `output`. |
| `BLOG_POST_ID_REQUIRED` | 400 | `id` is missing on `/v1/blog/content` or `/v1/blog/views`, or is present but empty (`?id=`) on any blog endpoint. |
| `BLOG_POST_ID_INVALID` | 400 | `id` is neither a hex post ID nor a valid slug. |
| `AUTHOR_FIELD_INVALID` | 400 | `field` names an unknown section. |
| `RESUME_CHECKSUM_REQUIRES_PDF` | 400 | `checksum` is given with an `output` other than `pdf` or `zip`. |
| `BLOG_POST_NOT_FOUND` | 404 | No published post matches `id`. |
| `RESUME_DOCUMENT_NOT_FOUND` | 404 | No active resume document, or it has no file URL. |
| `RESUME_SIGNATURE_NOT_FOUND` | 404 | `output=asc` or `output=sig` while the active resume is not signed by the active OpenPGP key, or the signature file is missing from storage. |
| `RESUME_BUNDLE_NOT_FOUND` | 404 | `output=zip` before the verification bundle was built, when it cannot be assembled on the fly. |
| `NOT_FOUND` | 404 | No endpoint at this path. |
| `METHOD_NOT_ALLOWED` | 405 | A method other than `GET`, `HEAD` or `OPTIONS`. |
| `BLOG_POST_ID_AMBIGUOUS` | 409 | The ID prefix matches more than one post. |
| `RATE_LIMITED` | 429 | More than 60 requests in 60 s from one IP. Wait `Retry-After` seconds. |
| `BLOG_LIST_FETCH_FAILED` | 500 | The post list query failed. |
| `BLOG_POST_FETCH_FAILED` | 500 | The post lookup failed. |
| `BLOG_POST_COUNTS_FETCH_FAILED` | 500 | Comment or view counts failed (`/v1/blog?id=`). |
| `BLOG_COMMENTS_FETCH_FAILED` | 500 | The comments query failed. |
| `BLOG_VIEWS_FETCH_FAILED` | 500 | The view count failed. |
| `AUTHOR_FETCH_FAILED` | 500 | An author section failed to load. |
| `RESUME_METADATA_FETCH_FAILED` | 500 | Reading the active resume document, or the OpenPGP key a signature or bundle needs, failed. |
| `SEARCH_FETCH_FAILED` | 500 | The search query failed. |
| `ANALYTICS_FETCH_FAILED` | 500 | The analytics settings could not be read. |
| `BLOG_CONTENT_FETCH_FAILED` | 502 | The post body could not be read from storage. |
| `RESUME_FETCH_FAILED` | 502 | A resume file could not be fetched from storage. |
| `BAD_REQUEST` | 400 | Fallback for a `400` without a specific code. It should not occur. |
| `INTERNAL_ERROR` | 500 | An unhandled error (`app.onError`), also reported to Sentry. |

## Adding a code

1. Return it from the handler with `apiError(status, CODE, message, details?)`, or throw `ApiRequestError`. Never hand-roll error JSON.
2. Add it to this table **and** to the table in `apps/api/src/README.md`, which is served live at `GET /v1`.
3. Codes are part of the v1 contract. Never rename or repurpose an existing code under `/v1`.
