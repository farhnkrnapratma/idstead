<!-- @format -->

# Error Responses and Versioning

## Standardized error structure

Use one shape for every error response across the API. Machine-readable `code`, human-readable `message`:

```json
{
  "error": {
    "code": "INVALID_EMAIL",
    "message": "The email address format is invalid",
    "details": "Email must contain an @ symbol and valid domain",
    "field": "email"
  }
}
```

## Validation errors: return all at once

Don't make clients fix errors one at a time — report every failing field in a single response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {"field": "email", "message": "Email address is required"},
      {"field": "password", "message": "Password must be at least 8 characters"}
    ]
  }
}
```

## Versioning

Decide a strategy from the start, even with only one version live.

**URI versioning** — version in the path, explicit and simple:

```
GET /v1/users
GET /v2/users
```

**Header versioning** — cleaner URLs, requires clients to set headers correctly:

```
GET /users
Accept: application/vnd.api.v1+json
```

**When to bump the version**: only for breaking changes — removed fields, changed types, changed auth. Non-breaking additions (new optional fields, new endpoints) don't need a new version.

## Deprecation process

1. Announce changes early
2. Provide migration guidance
3. Support old and new versions in parallel for a transition period

Signal deprecation in the response itself:

```
Deprecated: true
X-API-Warn: This endpoint is deprecated and will be removed on 2025-06-01. Use /v2/users instead.
```

## Backward compatibility principle

**Add, don't remove.** New fields or endpoints don't break clients that ignore them; removing or renaming fields does. Prefer additive changes whenever possible.
