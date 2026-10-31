# v1 Discovery

These are the machine-readable descriptions of the API. Each one is generated from `packages/lib/src/openapi.ts` and `apps/api/src/README.md`, so changing those two files changes all of them.

## On `api.example.com`

| Path | Content |
| --- | --- |
| `GET /v1` | `apps/api/src/README.md` as `text/markdown`, the default. With `?output=json` or `Accept: application/json` it returns `{name, version, docs: "/v1", openapi: "/v1/openapi.json", endpoints: [{method, path, summary, parameters}]}`, derived from the OpenAPI paths. |
| `GET /v1/openapi.json` | OpenAPI 3.0.3, `info.version` `1.0.0`. `servers` is set to the request origin. |
| `GET /v1/openapi.yaml` | The same spec as `application/yaml; charset=utf-8`. |

Both OpenAPI files are cached with `s-maxage=300` and get an ETag.

## On `example.com`

| Path | Content |
| --- | --- |
| `/.well-known/openapi.json`, `/.well-known/openapi.yaml` | Mirror of the spec, with `servers` set from `PUBLIC_API_BASE_URL` |
| `/llms.txt`, `/.well-known/llms.txt` | Markdown index for LLM agents |
| `/.well-known/agent-skills/index.json` | `{skills: [{name, type: "skill-md", description, url, digest}]}`. `digest` is `sha256:<hex>` of the exact UTF-8 bytes of the SKILL.md. |
| `/.well-known/agent-skills/{name}/SKILL.md` | One skill per OpenAPI path. The name comes from the path: `/v1/blog/content` becomes `blog-content`, and `/v1` becomes `api`. |
| `/.well-known/api-catalog` | RFC 9727 linkset (`application/linkset+json`) |
| `/.well-known/ard.json` | ARD manifest `{entries}` (see [../ard.md](../002-ard.md)) |

Every HTML page on `example.com` also sends these `Link` headers ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288), [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727#section-3)), built by `discoveryLinks` in `packages/lib/src/server/discoveryLinks.ts`:

- `</.well-known/api-catalog>; rel="api-catalog"`
- `<https://api.example.com/v1/openapi.json>; rel="service-desc"`
- `<https://api.example.com/v1>; rel="service-doc"`
- `</.well-known/agent-skills/index.json>; rel="describedby"`
- `</.well-known/ard.json>; rel="ard"`
- `</llms.txt>; rel="describedby"`
- `</sitemap.xml>; rel="sitemap"`

Every `/.well-known/*` response gets an ETag.

## Keeping it in sync

When a route, parameter or response shape changes:

1. Update the handler in `packages/lib/src/server/api/`.
2. Update `packages/lib/src/openapi.ts`. Paths are `/v1/...`.
3. Update `apps/api/src/README.md` (served at `GET /v1`) and the matching page in `docs/004-api/001-v1/`.
4. Run `bun run test`. To run the live suite against a worker, see [testing](../../005-development/002-testing.md).

Known gaps in `openapi.ts`, as of 2026-10-15:

- No response headers are described (`ETag`, `X-RateLimit-*`, `Repr-Digest`, …).
- `404` and `405` responses are not listed per path.
- The `Author` schema is `additionalProperties: true` instead of the section shapes in [author.md](004-author.md).
