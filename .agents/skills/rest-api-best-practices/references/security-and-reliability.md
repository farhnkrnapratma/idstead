# Security, Idempotency, Observability, and Reliability

## Authentication

**API keys** — simple, for server-to-server communication. Not sufficient as the only security layer for sensitive operations:

```
GET /api/users
X-API-Key: sk_live_abc123xyz789
```

**Bearer tokens (OAuth 2.0)** — for user-specific auth, supports time-limited access and scopes:

```
GET /api/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Always use HTTPS.** HTTP transmits credentials and data in plain text.

## Rate limiting

Return usage headers on every response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1640995200
```

When exceeded, return `429 Too Many Requests` with retry timing info.

## Idempotency

Idempotent = calling it N times has the same effect as calling it once.

- GET, HEAD — naturally idempotent (no state change)
- PUT, DELETE — must be idempotent by design (`PUT /users/123` always ends in the same state; repeated `DELETE /users/123` calls return `404` after the first)
- POST — not idempotent by default (each call may create a new resource). For risky operations (payments, orders), require an `Idempotency-Key` header so the server can detect and safely respond to a retried request without duplicating the action:

```
POST /payments
Idempotency-Key: unique-key-abc123
Content-Type: application/json
{ "amount": 100.00, "currency": "USD" }
```

## CORS

Configure explicitly — don't default to wildcard for private APIs:

```
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Content types

JSON is the default:

```
Content-Type: application/json
Accept: application/json
```

Support content negotiation (e.g., `Accept: application/pdf`) only where a genuine alternate format is needed. JSON should remain the primary format.

## Response shaping

- **Field selection**: let clients request only what they need — `GET /users/123?fields=name,email` — smaller payloads, especially for mobile clients.
- **Avoid deep nesting.** Flat structures are easier to parse and don't leak internal data models.

Good:

```json
{
    "user": { "id": "123", "name": "Phil Ostman" },
    "organization_id": "org-456",
    "organization_name": "Tech Corp"
}
```

Bad (leaks internal model depth):

```json
{
    "user": {
        "id": "123",
        "name": "Phil Ostman",
        "organization": {
            "id": "org-456",
            "name": "Tech Corp",
            "details": { "industry": "Technology", "settings": { "timezone": "UTC" } }
        }
    }
}
```

## Observability

- Log method, endpoint, status code, and latency for every request
- Track error rates and slow endpoints; alert on anomalies
- Return a unique request ID on every response so client reports can be correlated with server logs:

```
X-Request-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
```

## Testing dimensions

Beyond happy-path tests, cover:

- Authentication failures
- Validation errors
- Rate limiting
- Edge cases and retries

Use unit tests (individual components), integration tests (components together), and end-to-end tests (full client-perspective workflows).

## Documentation as contract

Every endpoint needs: HTTP method, URL, required params, request/response body format, status codes, and auth requirements — plus a working request/response example that stays in sync with the real API. Treat examples, tests, docs, and monitoring as one contract; letting them drift apart is the most common cause of API reliability problems.
