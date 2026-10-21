# Public API

The public REST API is read-only and needs no authentication. It is served by the `idstead-api` Worker (`apps/api`) at **`https://api.example.com`**.

## Versions

| Version | Base path | Status  | Docs                    |
| ------- | --------- | ------- | ----------------------- |
| v1      | `/v1`     | Current | [v1/](001-v1/README.md) |

## Versioning policy

- A **breaking change** ships under a new version path (`/v2`) and never in place under `/v1`. Breaking changes include removing or renaming a field, changing a type, removing an endpoint or parameter, and changing an error code or a default.
- **Additive changes** may land in the current version: a new optional field, endpoint, parameter or error code.
- The October 2026 reshape of v1 and its move from `example.com/api/v1` to `api.example.com/v1` were one-time exceptions, not a precedent.
- The OpenAPI document version (`info.version`, currently `1.0.0`) tracks the v1 contract.

To start a new version:

1. Add `docs/004-api/v2/`, using the `v1/` layout.
2. Add a row to the table above.
3. Keep `v1/` frozen except for corrections.

## Other machine-readable surfaces

| Surface | Host | Docs |
| --- | --- | --- |
| OpenAPI 3 spec | `api.example.com/v1/openapi.{json,yaml}`, mirrored at `example.com/.well-known/openapi.{json,yaml}` | [v1/discovery.md](001-v1/006-discovery.md) |
| Agent discovery (`llms.txt`, agent skills, api-catalog) | `example.com` | [v1/discovery.md](001-v1/006-discovery.md) |
| Agent Registry Discovery (`/api/ard/**`) | `example.com` (unversioned) | [ard.md](002-ard.md) |

Endpoints under `/api/internal/**` on `example.com` and `admin.example.com` are first-party only. They are deliberately undocumented as an API and can change at any time. Their architecture is described in [architecture/4](../003-architecture/004-public-write-endpoints.md) and [architecture/10](../003-architecture/010-endpoint-reference.md).

## Sources of truth

- `apps/api/src/README.md` is served live at `GET /v1`. Keep it consistent with these docs.
- `packages/lib/src/openapi.ts` holds the OpenAPI spec.
- `packages/lib/src/server/api/*.ts` holds the handlers.
- `tests/apiV1.test.ts` (live), `tests/apiV1Handlers.test.ts` and `tests/apiParams.test.ts` pin the behaviour.
