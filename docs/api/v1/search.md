# v1 Search

Handler: `getSearch` in `packages/lib/src/server/api/blog.ts`.

## `GET /v1/search`

| Parameter     | Default | Notes                                                          |
| ------------- | ------- | -------------------------------------------------------------- |
| `query` / `q` | –       | case-insensitive substring match on post `title` and `excerpt` |
| `page` / `p`  | 1       | no maximum                                                     |
| `limit` / `n` | 6       | maximum 20                                                     |

This endpoint has no `output` parameter; the response is always JSON.

```json
{
    "query": "gnome",
    "data": [{ "type": "post", "id": "…64 hex…", "title": "…", "subtitle": "…", "url": "/blog/…" }],
    "pagination": { "page": 1, "limit": 6, "returned": 1, "hasMore": false }
}
```

- `subtitle` is the post excerpt, or `"Blog post"` when the post has none.
- `url` is a path relative to `https://fkp.my.id`.
- Keep requesting the next `page` until `hasMore` is `false`. Pagination uses `returned`/`hasMore`, which differs from the `/v1/blog` list.
- A query shorter than 2 characters, or one that is empty after escaping, returns `200` with empty `data` and `hasMore: false`. It is not an error.

```sh
curl "https://api.fkp.my.id/v1/search?q=gnome&n=10"
```

## Errors

`SEARCH_FETCH_FAILED` (500), plus the shared errors in [errors.md](errors.md).
