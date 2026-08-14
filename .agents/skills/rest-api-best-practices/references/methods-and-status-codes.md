<!-- @format -->

# Resource Naming, HTTP Methods, and Status Codes

## Resource naming

**Use nouns, not verbs.** HTTP methods already describe the action; URLs describe the resource.

Good:

```
GET /users
POST /orders
DELETE /products/123
```

Bad:

```
GET /getUsers
POST /createOrder
DELETE /deleteProduct/123
```

**Keep URLs predictable.** Plural nouns for collections, consistent patterns throughout:

```
GET    /users       → List all users
GET    /users/123   → Get specific user
POST   /users       → Create new user
PUT    /users/123   → Update user
DELETE /users/123   → Delete user
```

**Nested resources** should reflect real relationships but stay shallow (max ~2 levels):

```
GET /users/123/orders   → Orders for a specific user
GET /orders/456/items   → Items in a specific order
```

More than two levels usually signals a resource modeling problem — flatten it or add a dedicated endpoint instead.

## HTTP methods

| Method | Purpose | Idempotent | Notes |
| --- | --- | --- | --- |
| GET | Read-only retrieval | Yes | Safe, cacheable, no side effects. Never use for writes. Supports query params for filter/sort/paginate. |
| POST | Create a resource / trigger an action | No (by default) | Server assigns the new ID. Return `201 Created` with a `Location` header. Use an `Idempotency-Key` header if duplicate submissions are a risk. |
| PUT | Full replace of an existing resource | Yes | Send the complete resource representation. |
| PATCH | Partial update | No (not guaranteed) | Send only the fields that changed — efficient for large resources. |
| DELETE | Remove a resource | Yes | Return `204 No Content` or `200 OK` with details of what was deleted. Repeat calls should return `404`, not error. |

### Examples

```
POST /users
Content-Type: application/json
{ "name": "Phil Ostman", "email": "p.ostman@example.com" }
```

```
PUT /users/123
Content-Type: application/json
{ "name": "Phil Ostman", "email": "new-email@example.com", "role": "Developer" }
```

```
PATCH /users/123
Content-Type: application/json
{ "email": "updated@example.com" }
```

## HTTP status codes

Pick the specific code — inconsistent status codes are one of the most common causes of client-side bugs.

**2xx Success**

- `200 OK` — request succeeded, response has data
- `201 Created` — new resource created
- `202 Accepted` — accepted for async processing, not yet complete
- `204 No Content` — succeeded, no response body

**4xx Client error**

- `400 Bad Request` — invalid request format/params
- `401 Unauthorized` — authentication required or failed
- `403 Forbidden` — authenticated but lacks permission
- `404 Not Found` — resource doesn't exist
- `409 Conflict` — request conflicts with current state
- `422 Unprocessable Entity` — valid format, semantic/validation error

**5xx Server error**

- `500 Internal Server Error` — generic server failure
- `502 Bad Gateway` — invalid response from upstream
- `503 Service Unavailable` — server temporarily unavailable
- `504 Gateway Timeout` — upstream didn't respond in time
