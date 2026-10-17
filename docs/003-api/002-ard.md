# Agent Registry Discovery (`/api/ard/**`)

`fkp-web` serves a public, unversioned discovery API at **`https://fkp.my.id/api/ard`**. It lets AI agents find the site's registry entries: one registry entry, plus an API entry and a skill entry for each `/v1` operation. The entries are built by `createArdEntries()` (`packages/lib/src/server/ard.ts`) and persisted in `db_ard_index`.

This API is **not** part of `/v1` and has its own error shape.

## Common behaviour

- CORS `Access-Control-Allow-Origin: *`.
- The same rate limit as the rest of `fkp.my.id/api/*`: 60 requests per 60 s per IP.
- `POST` responses are `application/json; charset=utf-8` with `Cache-Control: no-store`.
- Errors use the shape `{"errorCode": "…", "message": "…"}`, with **no** `error` wrapper.

| Status | `errorCode` | When |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | wrong content type, body over 16 KiB, bad JSON, or an unknown or invalid field |
| 404 | `NOT_FOUND` | unknown path |
| 405 | `INVALID_ARGUMENT` | wrong method (see `Allow`) |
| 429 | `RATE_LIMIT_EXCEEDED` | over the rate limit |
| 500 | `INTERNAL_ERROR` | model or Worker failure |
| 503 | `INTERNAL_ERROR` | index unavailable, with `Retry-After: 60` |

## Endpoints

### `GET /api/ard`

Markdown documentation for the ARD API, with an ETag.

### `GET /api/ard/agents`: list entries

| Query | Default | Notes |
| --- | --- | --- |
| `pageSize` | 20 | 1 to 100 |
| `pageToken` | – | opaque, from a previous response (`[A-Za-z0-9_-]{1,64}`) |
| `orderBy` | `displayName` | `displayName`, `identifier`, `type`, `publisherId`, `createdAt`, `updatedAt` or `url`, optionally followed by ` ASC` or ` DESC` |
| `filter` | – | at most 2048 characters. Clauses are joined with `AND`, as `field = 'value'` over `displayName`, `type` and `publisherId`. `createdAfter` and `updatedAfter` also accept `>`, `>=`, `<` and `<=`. |

The response is `{items, total, pageToken?}`. `pageToken` is present only when there is another page.

### `POST /api/ard/search`: semantic search

```json
{
    "query": { "text": "read blog posts", "filter": { "type": "api" } },
    "federation": "auto",
    "pageSize": 10,
    "pageToken": "…"
}
```

- **`query.text`** is required, up to 2000 characters.
- **`query.filter`** values are a string or a non-empty array of strings, each up to 256 characters.
- **`federation`** is `auto` (the default), `referrals` or `none`.
- **`pageSize`** is 1 to 100, default 10.
- **Unknown top-level fields** are rejected.

The response is `{results: [entry + {score, source}], pageToken?}`. `referrals: []` is added when `federation` is `referrals`.

**Ranking:**

- Results are ranked with embeddings from the Workers AI `AI` binding. Results scoring below 35 (of 100) are dropped.
- **There is no lexical fallback.** Without the AI binding, the request fails with `500`.

### `POST /api/ard/explore`: facets

```json
{
    "query": { "text": "…" },
    "resultType": { "facets": [{ "field": "type", "limit": 20, "minCount": 1 }] }
}
```

- `query` is optional.
- A text query needs the AI binding.
- `limit` is 1 to 100 (default 20). `minCount` is 0 or more (default 1).

The response is `{resultType: "facets", facets: {…}}`.

## Methods

The allowed methods come from `publicAllow` in `apps/web/src/hooks.server.ts`:

| Path                                  | Allowed methods          |
| ------------------------------------- | ------------------------ |
| `/api/ard/search`, `/api/ard/explore` | `POST`, `OPTIONS`        |
| `/api/ard/agents`                     | `GET`, `HEAD`, `OPTIONS` |
| `/api/ard`                            | `GET`, `HEAD`, `OPTIONS` |

## Source

- `apps/web/src/routes/api/ard/**/+server.ts`, `apps/web/src/routes/.well-known/ard.json/+server.ts`
- `packages/lib/src/server/ard.ts`, `ardIndex.ts`, `ardIndexServer.ts`, `ardIngestion.ts`
- `tests/ard.test.ts`, `tests/ardIngestion.test.ts`
