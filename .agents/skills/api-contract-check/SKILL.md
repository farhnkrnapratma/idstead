---
name: api-contract-check
description: Verify src/routes/api/v1 routes follow this repo's API conventions — apiError() usage, error codes documented in README, and openapi.ts/well-known specs in sync. Use after adding or changing any /api/v1 route, or before a release touching the API.
---

# API contract check

`src/routes/api/v1/README.md` is the source of truth for this repo's public API and is also served live at `GET /api/v1`. Route handlers, the README, and `src/lib/openapi.ts` must all agree. Run this check after touching anything under `src/routes/api/v1`.

## Steps

1. **Find all route handlers**: `find src/routes/api/v1 -name '+server.ts'`

2. **Error envelope**: grep each handler for any JSON error response that does NOT go through `apiError()` (from `src/lib/server/apiError.ts`). Flag any hand-rolled `json({...}, {status: ...})` used for an error case — it must use `apiError(status, code, message, details?)` instead.

3. **Error codes**: extract every `apiError(...)` call's `code` argument across all routes, then cross-check each one appears in the error-codes table in `src/routes/api/v1/README.md`. Flag:
    - Codes used in code but missing from the README table.
    - Codes in the README table no longer used anywhere (dead documentation).
    - Reused generic codes (`BAD_REQUEST`, `INTERNAL_ERROR`, etc.) where a specific per-endpoint code would be expected instead — per `CLAUDE.md`, generic codes are fallback-only.

4. **Endpoint coverage**: for any new or changed route path/method, confirm it's listed in the "Endpoints" table in the README with an accurate description (query params, body shape, status codes).

5. **OpenAPI sync**: check `src/lib/openapi.ts` for a matching path/schema entry for any new or changed endpoint. If missing or stale, flag it — `/.well-known/openapi.json` and `openapi.yaml` are generated from this file and must stay in sync per `CLAUDE.md`.

6. **format=md scope**: if a route was changed to support `?format=md` / `Accept: text/markdown`, confirm it's one of the three endpoints where this is documented as supported (`/api/v1/blog`, `/api/v1/blog/{id_or_slug}`, `/api/v1/author`). Flag if added elsewhere without updating the README's stated scope, or if claimed supported elsewhere without an implementation.

7. **Versioning**: flag any breaking change (removed field, changed type, removed endpoint) made in place under `/api/v1` — these must ship under a new `/api/v2/` per `CLAUDE.md`.

## Output

List each finding as: file:line, what's inconsistent, and the specific fix (e.g. "add `WIDGET_NOT_FOUND` to the error codes table in README.md" or "replace hand-rolled `json()` call with `apiError()`"). If everything is consistent, say so explicitly — don't invent findings.
