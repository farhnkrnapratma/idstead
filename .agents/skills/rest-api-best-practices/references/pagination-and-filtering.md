# Pagination, Filtering, Sorting, Search

## Pagination strategies

**Page-number** — traditional, easy to reason about:

```
GET /products?page=3&per_page=20
```

```json
{
    "data": [],
    "pagination": { "current_page": 3, "total_pages": 15, "total_items": 287, "per_page": 20 }
}
```

**Limit/offset** — simple, but can skip or repeat items if the collection changes mid-pagination:

```
GET /products?limit=20&offset=40
```

**Cursor-based** — opaque token pointing to a position in the result set. Preferred for feeds and high-write datasets because it stays consistent even as data changes:

```
GET /products?limit=20&cursor=eyJpZCI6MTIzfQ
```

```json
{ "data": [], "pagination": { "next_cursor": "eyJpZCI6MTQzfQ", "has_more": true } }
```

Always include pagination metadata in the response — don't make clients guess whether more pages exist.

## Filtering

Use clear, self-explanatory query parameter names:

```
GET /products?category=electronics&price_min=100&price_max=500
```

## Sorting

Specify field and direction; support multiple sort keys when useful:

```
GET /products?sort=price:asc
GET /users?sort=created_at:desc
GET /products?sort=category:asc,price:desc
```

## Search

```
GET /products?search=wireless keyboard
GET /articles?q=api+design
```

For more advanced needs, consider fuzzy matching or field-specific search parameters.
