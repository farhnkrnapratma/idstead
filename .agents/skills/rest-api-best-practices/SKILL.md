---
name: rest-api-best-practices
description: Reference guide for designing, reviewing, or refactoring REST APIs — resource naming, HTTP methods, status codes, error formats, versioning, pagination, filtering, authentication, idempotency, CORS, documentation, and observability. Use this skill whenever the user is designing a new REST API, adding endpoints to an existing one, reviewing API design for consistency, writing API documentation, debugging inconsistent status codes or error responses, or asks "is this good REST API design" — even if they don't say "REST" or "API best practices" explicitly. Also trigger for questions about endpoint naming, HTTP verb choice, pagination strategy, API versioning strategy, or error response structure.
---

<!-- @format -->

# REST API Best Practices

Source: Postman Team, "REST API Best Practices: A Developer's Guide to Building Reliable APIs" (Dec 2025). Adapted as an operational checklist for designing and reviewing APIs.

## How to use this skill

1. Identify what the user needs: **design** (new endpoint/API), **review** (audit existing API), or **fix** (debug a specific inconsistency).
2. Run the relevant section(s) below as a checklist. Don't dump the whole guide — apply only what's relevant to the request.
3. For anything beyond the quick reference, read the matching file in `references/` before answering. Each file is self-contained and loaded only when needed.
4. When reviewing existing code/API specs, flag deviations explicitly (e.g., "uses GET for a state change at `/cart/add`") rather than only describing the ideal.

## Quick reference checklist

- **Naming**: nouns, not verbs. Plural collections (`/users`, not `/getUsers`). Max ~2 levels of nesting.
- **Methods**: GET (read, safe, cacheable), POST (create), PUT (full replace, idempotent), PATCH (partial update), DELETE (remove, idempotent). Never GET for state changes.
- **Status codes**: 2xx success, 4xx client error, 5xx server error — pick the specific code, not just 200/400/500. See `references/methods-and-status-codes.md`.
- **Errors**: consistent JSON shape with a stable `code`, human `message`, and field-level `details` for validation errors. Return all validation errors at once, not one at a time. See `references/errors-and-versioning.md`.
- **Versioning**: URI (`/v1/users`) or header (`Accept: application/vnd.api.v1+json`). Decide before shipping v1, even with only one version. New version only for breaking changes. See `references/errors-and-versioning.md`.
- **Pagination**: page-number, limit/offset, or cursor-based. Cursor-based for feeds/high-write data. Always include pagination metadata in the response. See `references/pagination-and-filtering.md`.
- **Filtering/sorting/search**: query params with clear names (`?category=x&sort=price:asc&search=...`). See `references/pagination-and-filtering.md`.
- **Security**: HTTPS always. API keys for server-to-server; OAuth 2.0 bearer tokens for user-specific auth. Rate limit with `X-RateLimit-*` headers and `429` on limit. See `references/security-and-reliability.md`.
- **Idempotency**: GET/PUT/DELETE must be idempotent by design. Use an `Idempotency-Key` header for POST when duplicates are a risk (e.g., payments). See `references/security-and-reliability.md`.
- **Responses**: flat structure over deep nesting; support field selection (`?fields=name,email`) for large resources.
- **Observability**: log method, endpoint, status, latency; return an `X-Request-ID` on every response. See `references/security-and-reliability.md`.
- **Docs**: every endpoint needs method, URL, params, request/response body, status codes, auth, and a working example. Keep examples in sync with reality — treat docs as part of the API contract.

## Common mistakes to flag when reviewing

| Mistake | Fix |
| --- | --- |
| `GET /users/123/delete` | `DELETE /users/123` |
| `GET /cart/add?product_id=789` | `POST /cart/items` |
| `GET /user_table_v2/query?db_id=123` | `GET /users/123` |
| Inconsistent casing/pluralization across endpoints | Pick one convention (plural nouns, snake_case or camelCase) and apply it everywhere |
| More than ~2 levels of URL nesting | Flatten, or introduce a dedicated endpoint |
| One validation error returned at a time | Return all validation errors in a single response |
| Generic 200/400/500 for everything | Use the specific status code that matches the outcome |

## References

- `references/methods-and-status-codes.md` — HTTP methods (GET/POST/PUT/PATCH/DELETE), full status code table, resource naming rules
- `references/errors-and-versioning.md` — standardized error response shape, validation error format, URI vs. header versioning, deprecation process
- `references/pagination-and-filtering.md` — page-number, limit/offset, cursor pagination; filtering, sorting, search patterns
- `references/security-and-reliability.md` — API keys vs. OAuth 2.0, HTTPS, rate limiting, idempotency, CORS, content negotiation, response shaping, observability, backward compatibility, testing dimensions
