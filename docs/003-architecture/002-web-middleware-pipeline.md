# 2. Web Worker (idstead-web) Request Pipeline

The order of work in `apps/web/src/hooks.server.ts`. It runs as `sequence(sentryInitHandle, Sentry.sentryHandle(), <inline handler>)`.

```mermaid
flowchart TD
    A([Request]) --> S["Sentry init + sentryHandle"]
    S --> RID["requestId = x-request-id or randomUUID()"]
    RID --> WWW{"host = www.example.com?"}
    WWW -->|yes| R301([301 to https://example.com + path])
    WWW -->|no| IA{"identity asset?<br/>icons, favicon, avatar.*, /hero.png"}
    IA -->|"non GET/HEAD"| R405([405 Allow: GET, HEAD])
    IA -->|yes| SIA(["serveIdentityAsset()<br/>R2 via S3, 503 on storage error"])
    IA -->|no| CDNQ{"/static/, /fonts/, /logo/?"}
    CDNQ -->|yes| CDN(["fetch PUBLIC_CDN_BASE_URL + path<br/>retry under /static for fonts/logo<br/>200 immutable, upstream status, 500 or 502"])
    CDNQ -->|no| SEC{"/home?"}
    SEC -->|yes| R308([308 to /])
    SEC -->|no| CLS["classify: isApiRequest, isInternalApi, isArdRequest"]
    CLS --> OPT{"/api/* and OPTIONS?"}
    OPT -->|"internal + foreign Origin"| R403([403])
    OPT -->|yes| R204([204 preflight<br/>public: Allow-Origin *])
    OPT -->|no| RLQ{"/api/*?"}
    RLQ -->|yes| RL{"checkRateLimit(clientIp)<br/>60 req / 60 s"}
    RL -->|limited| R429(["429<br/>ARD: {errorCode}<br/>other: {error:{code:'RATE_LIMITED'}}"])
    RL -->|ok| RES
    RLQ -->|no| RES["resolve(event) through pageDataCache:<br/>section page __data.json from the edge cache (60 s)<br/>collapse CDN // in HTML"]
    RES --> H1["HTML: Content-Security-Policy"]
    H1 --> H2["internal or preview host: X-Robots-Tag noindex<br/>internal or status ≥ 400: Cache-Control no-store"]
    H2 --> H3["public /api/*: Vary Accept, Expose-Headers, Allow-Origin *<br/>all /api/*: X-Request-ID, X-RateLimit-*"]
    H3 --> ENV{"/api/* and needsApiEnvelope?"}
    ENV -->|yes| E(["apiErrorEnvelope()"])
    ENV -->|no| LINK["HTML: Link headers<br/>api-catalog, agent-skills, ard, llms.txt, sitemap"]
    LINK --> ET{"200 GET/HEAD on public /api/* or /.well-known/*,<br/>no ETag, not PDF?"}
    ET -->|yes| ETAG["publicResponse(): ETag, 304 on match"]
    ET -->|no| HEAD
    ETAG --> HEAD["HEAD: drop body"]
    HEAD --> Z([Response])
```

## Notes

- Identity assets, the CDN proxy, redirects, preflight and 429 all **return early**. None of the later header steps run for them.
- **Cross-origin `/api/internal/*`:**
    - The hook rejects these requests only for `OPTIONS` preflight (403).
    - Each internal handler enforces same-origin itself through `isSameOriginRequest()` (`packages/lib/src/server/sameOrigin.ts`).
- **Rate limiting:**
    - It applies only to `/api/*`, after the preflight check.
    - `API_RATE_LIMITER` is the Workers Rate Limiting binding (namespace `1001`).
    - Without the binding, an in-memory fallback is used.
- **Preview hosts** are `PUBLIC_SENTRY_ENVIRONMENT=preview`, `*.pages.dev` and `*.workers.dev`.
- **Errors:** `handleError` is `Sentry.handleErrorWithSentry()`.

## Source

- `apps/web/src/hooks.server.ts`
- `packages/lib/src/server/profileAssets.ts` (`assetNames`, `serveIdentityAsset`)
- `packages/lib/src/server/rateLimit.ts`, `csp.ts`, `apiEnvelope.ts`, `publicResponse.ts`, `pageDataCache.ts`
