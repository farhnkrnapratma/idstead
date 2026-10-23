# 5. Public API Worker (idstead-api)

How a request moves through the Hono worker at `api.example.com`. Endpoints, parameters, response shapes and error codes are in **[docs/004-api/001-v1](../004-api/001-v1/README.md)**.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant M as Hono middleware (app.use '*')
    participant R as Route + runApi()
    participant HND as Handler (packages/lib/src/server/api)
    participant DB as D1 (DB binding)
    participant ST as R2 (ASSET_BUCKET, content/)

    C->>M: GET /v1/...
    M->>M: requestId = x-request-id or randomUUID()
    alt OPTIONS
        M-->>C: 204 CORS preflight (Allow-Origin *, Max-Age 86400)
    end
    M->>M: checkRateLimit(clientIp): API_RATE_LIMITER, namespace 1002
    alt over 60 requests / 60 s
        M-->>C: 429 RATE_LIMITED + Retry-After (enveloped)
    end
    alt method not GET or HEAD
        M-->>C: 405 METHOD_NOT_ALLOWED + Allow: GET, HEAD, OPTIONS
    end
    M->>R: next()
    R->>HND: getBlog / getBlogContent / getBlogComments / getBlogViews / getAuthor / getSearch / getRoot
    HND->>HND: parseApiParams(url, allowed), resolveOutput()
    HND->>DB: select (published rows only)
    opt /v1/blog/content
        HND->>ST: GET public URL of storage_path
    end
    opt /v1/cv?output=pdf
        HND->>HND: fetch db_documents.file_url (CDN), add Repr-Digest / X-Checksum-SHA256
    end
    HND-->>R: Response or {code, message, details?}
    R-->>M: response
    alt status ≥ 400 or HTML (needsApiEnvelope)
        M-->>C: apiErrorEnvelope: {error:{code, message, details?}}, no-store
    else 200, no ETag, not PDF
        M->>M: publicResponse(): ETag, 304 if If-None-Match matches
    end
    M->>M: X-Request-ID, Allow-Origin *, Expose-Headers, Vary: Accept,<br/>X-RateLimit-*, noindex on preview, empty body for HEAD
    M-->>C: response
```

## Notes

- **Read-only public repositories:**
    - The worker only builds `dataStores({ env }, { bannerUrls: false }).public`, the published and public rows.
    - Post content is read from the `ASSET_BUCKET` R2 binding.
- **Fallback handlers:**
    - `app.notFound` returns `NOT_FOUND`.
    - `app.onError` reports to Sentry and returns `INTERNAL_ERROR`. Both are wrapped by the envelope.
- **OpenAPI:** `/v1/openapi.json` and `/v1/openapi.yaml` come from `packages/lib/src/openapi.ts`, with `servers` set to the request origin and `s-maxage=300`.
- **Root routes:** `/` redirects 301 to `/v1`. `/robots.txt` allows everything.

## Source

- `apps/api/src/index.ts`
- `packages/lib/src/server/api/{blog,author,root,params,responses}.ts`
- `packages/lib/src/server/apiEnvelope.ts`, `publicResponse.ts`, `rateLimit.ts`
