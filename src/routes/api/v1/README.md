# fkp.my.id — Public REST API (v1)

This document is the canonical, up-to-date human reference for the public REST API. Machine-readable OpenAPI is served at:

- JSON: `/.well-known/openapi.json` and `/api/openapi.json`
- YAML: `/.well-known/openapi.yaml` and `/api/openapi.yaml`

Versioning: this repository serves v1. Breaking changes require a new path prefix: `/v2/...`.

Principles applied: plural nouns, consistent camelCase payloads, explicit status codes, page/limit pagination, standardized error envelope, and observability headers (X-Request-ID).

---

Base URL

- `https://fkp.my.id` (use `http://localhost:<port>` for local dev)

Authentication

- Public endpoints: no auth
- Admin endpoints: Bearer token from Supabase Auth (send in `Authorization: Bearer <token>`)

Error envelope

All error responses return JSON with the shape:

{
  "code": 401,
  "error": "401 Unauthorized: Authentication is required to access this privileged endpoint."
}

Observability

- Every API response includes `X-Request-ID` for tracing.
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

Caching

- GET responses include `Cache-Control`. Sensitive or write responses use `no-store`.

---

Endpoints (summary)

- GET /api/author — author profile (fields query, format=json|md)
- GET /api/blog — list posts (q,page,limit,format)
- GET /api/blog/{id_or_slug} — single post
- GET /api/cv — download CV (application/pdf)
- GET/POST /api/comments — comments (proxied to Supabase Edge Function)
- GET/POST /api/views — view counts (rate-limited)
- GET /api/search — search posts
- POST /api/admin/cv/upload — admin (proxied to Supabase Edge Function)
- POST /api/admin/cv/delete — admin (proxied to Supabase Edge Function)

See the OpenAPI JSON/YAML for machine-readable schemas and examples.

Pagination

- Use `page` (1-based) and `limit` for page-based results. Responses include `meta` with `total`, `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`.

Content negotiation

- `?format=md` overrides `Accept` header when present. Default `application/json`.

Security notes

- Never expose service_role keys in client code. Edge Functions perform privileged writes and must validate authorization server-side.

Migration note

- `/api/comments` and `/api/admin/cv/*` are now proxied to Supabase Edge Functions (comments-api, admin-cv-upload, admin-cv-delete). Deploy these functions in your Supabase project and confirm their publicly routable function URLs match the proxy helper configuration.

Contact

For issues or updates, open an issue or contact the site maintainer via `/api/author?contact=true`.
