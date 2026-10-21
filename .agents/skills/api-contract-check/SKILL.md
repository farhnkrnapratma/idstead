---
name: api-contract-check
description: Verify the public API worker (apps/api, handlers in packages/lib/src/server/api) follows this repo's API conventions — apiError() usage, error codes documented, openapi.ts and docs in sync, no breaking change under /v1. Use after adding or changing any /v1 route, parameter, response shape or error code, or before a release touching the API.
---

# API contract check

The public API is the Hono worker at `apps/api/src/index.ts` (`api.example.com/v1`). Routes only wrap handlers from `packages/lib/src/server/api/` (`blog.ts`, `author.ts`, `root.ts`, `params.ts`, `responses.ts`) in `runApi()`. Four descriptions of the contract must agree with the handlers:

- `apps/api/src/README.md`: served live at `GET /v1`, holds the error-code table
- `packages/lib/src/openapi.ts`: served at `/v1/openapi.{json,yaml}`, mirrored at `example.com/.well-known/openapi.*`, and drives `llms.txt` / agent skills
- `docs/004-api/001-v1/*.md`: the extended reference
- `tests/apiV1.test.ts`, `tests/apiV1Handlers.test.ts`, `tests/apiParams.test.ts`

## Steps

1. **Routes**: `rg -n "^app\.get" apps/api/src/index.ts`. Every `/v1/...` route must appear in the README Endpoints tables, in `openapi.ts` `paths`, and in `docs/004-api/001-v1/README.md`.

2. **Error envelope**:
    - Handlers must return errors through `apiError(status, CODE, message, details?)` or throw `ApiRequestError`.
    - Flag any hand-rolled `Response.json({...}, {status: 4xx|5xx})` in a handler. The worker's `notFound`/`onError` fallbacks are the only exceptions.

3. **Error codes**:
    - Collect every code: `rg -o "'[A-Z][A-Z_]{3,}'" packages/lib/src/server/api packages/lib/src/server/postLookup.ts apps/api/src/index.ts`.
    - Cross-check against the README table **and** `docs/004-api/001-v1/002-errors.md`. Flag codes missing from either, codes documented but no longer produced, and generic codes (`BAD_REQUEST`, `INTERNAL_ERROR`) used where a specific per-endpoint code is expected.

4. **Parameters**:
    - Every handler parses its query with `parseApiParams(url, allowed)`. Check that the `allowed` list matches the README and `docs/004-api/001-v1/001-parameters.md`.
    - Single resources use `?id=`, never a path segment.

5. **Outputs**:
    - For each `resolveOutput(params, request, supported, fallback)`, confirm the supported list and default match the docs. For example, `/v1/blog/content` defaults to `md`, and `pdf` is valid only for `field=cv`.
    - `/v1/cv` must stay byte-identical to `/v1/author?field=cv`.

6. **No database IDs**: responses must expose posts only by `public_id` (as `id`). Flag any UUID or `*_id` column in a response shape.

7. **OpenAPI sync**: any new or changed path, parameter or schema needs a matching update in `packages/lib/src/openapi.ts`. Paths are written `/v1/...`.

8. **Versioning**:
    - Flag any breaking change made in place under `/v1`: a removed or renamed field, a changed type or default, a removed endpoint or parameter, or a changed error code.
    - Breaking changes must ship under a new `/v2` and a new `docs/004-api/002-v2/ (renumbering the pages after it)`.

## Output

List each finding as: `file:line`, what is inconsistent, and the specific fix. Example: "add `WIDGET_NOT_FOUND` to the README table and `docs/004-api/001-v1/002-errors.md`". If everything is consistent, say so explicitly. Don't invent findings.
