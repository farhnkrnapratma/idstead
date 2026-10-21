# v1 Blog

Handlers: `getBlog`, `getBlogContent`, `getBlogComments`, `getBlogViews` in `packages/lib/src/server/api/blog.ts`. Only published posts and approved comments are visible.

## Post object

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | 64-hex public ID (`db_posts.public_id`), immutable |
| `slug` | string | URL slug; the post page is `https://example.com/blog/{slug}` |
| `title` | string |  |
| `excerpt` | string \| null | written by hand |
| `summary` | string \| null | generated when the post is saved |
| `tldr` | string[] | generated, may be empty |
| `tags` | string[] |  |
| `collaborators` | string[] |  |
| `created_at` | string (ISO 8601) |  |
| `updated_at` | string (ISO 8601) | falls back to `created_at` |

The single-post form adds `comment_count` (approved only) and `views_count`.

---

## `GET /v1/blog`: list posts

| Parameter      | Default | Notes                                                     |
| -------------- | ------- | --------------------------------------------------------- |
| `query` / `q`  | –       | case-insensitive substring match on `title` and `excerpt` |
| `page` / `p`   | 1       | no maximum                                                |
| `limit` / `n`  | 20      | maximum 100                                               |
| `output` / `o` | `json`  | `json` or `md`                                            |

Posts are ordered newest first (`created_at` desc, then `public_id`).

```json
{
    "data": [
        {
            "id": "…64 hex…",
            "slug": "…",
            "title": "…",
            "excerpt": "…",
            "summary": null,
            "tldr": [],
            "tags": [],
            "collaborators": [],
            "created_at": "…",
            "updated_at": "…"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 0,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
    }
}
```

`totalPages` is always at least 1. A `page` past the last page is not an error: it returns an empty `data` array with the real `total` and `totalPages`, and `hasNextPage: false`. `output=md` returns a Markdown catalog: a `# Posts Catalog` heading, the page and total, then one block per post separated by `---`.

## `GET /v1/blog?id=…`: one post

| Parameter      | Default  | Notes                                      |
| -------------- | -------- | ------------------------------------------ |
| `id`           | required | see [post IDs](001-parameters.md#post-ids) |
| `output` / `o` | `json`   | `json`, `md` or `txt`                      |

The response is the post object plus `comment_count` and `views_count`. Combining `id` with `query`, `page` or `limit` returns `400 PARAM_CONFLICT`.

```sh
curl "https://api.example.com/v1/blog?id=update-gnome-51"
curl "https://api.example.com/v1/blog?id=3f9a1c2&o=md"
```

## `GET /v1/blog/content?id=…`: post body

| Parameter | Default | Notes |
| --- | --- | --- |
| `id` | required |  |
| `output` / `o` | `md` | `md` (raw Markdown), `txt` (plain text), or `json` (`{id, slug, title, content}`) |

The body is read from Supabase Storage (`blog-posts`). A missing or unreadable file returns `502 BLOG_CONTENT_FETCH_FAILED`.

```sh
curl "https://api.example.com/v1/blog/content?id=3f9a1c2&o=txt"
```

## `GET /v1/blog/comments`: approved comments

| Parameter     | Default  | Notes                                                              |
| ------------- | -------- | ------------------------------------------------------------------ |
| `id`          | optional | with it: one post's threads; without it: recent comments site-wide |
| `limit` / `n` | 50       | maximum 100                                                        |

The endpoint has no `output` parameter, and comments carry no identifiers. When `is_anonymous` is `true`, `author_name` is always `"Anonymous"`; the stored name is never returned.

**With `id`:** threads oldest first. `limit` caps the number of **top-level** threads, and `hasMore` tells you whether more exist. A reply whose parent is missing is promoted to a top-level thread. At most 1000 comments per post are read.

```json
{
    "id": "…64 hex…",
    "slug": "…",
    "data": [
        {
            "author_name": "…",
            "content": "…",
            "is_admin": false,
            "is_anonymous": false,
            "created_at": "…",
            "replies": []
        }
    ],
    "hasMore": false
}
```

**Without `id`:** newest first, up to `limit`. There is no pagination and no `hasMore`.

```json
{
    "data": [
        {
            "post": { "id": "…", "slug": "…" },
            "author_name": "…",
            "content": "…",
            "is_admin": false,
            "is_anonymous": false,
            "is_reply": false,
            "created_at": "…"
        }
    ]
}
```

This API cannot submit comments.

## `GET /v1/blog/views?id=…`: view count

| Parameter | Default  |
| --------- | -------- |
| `id`      | required |

```json
{ "id": "…64 hex…", "slug": "…", "views": 0 }
```

`views` is the number of rows in `db_views` for the post. The site records at most one view per visitor per day (see [architecture/4](../../001-architecture/004-public-write-endpoints.md)).

## Errors

The errors specific to these endpoints are:

- `BLOG_POST_ID_REQUIRED`, `BLOG_POST_ID_INVALID`, `BLOG_POST_NOT_FOUND`, `BLOG_POST_ID_AMBIGUOUS`
- `BLOG_LIST_FETCH_FAILED`, `BLOG_POST_FETCH_FAILED`, `BLOG_POST_COUNTS_FETCH_FAILED`
- `BLOG_CONTENT_FETCH_FAILED`, `BLOG_COMMENTS_FETCH_FAILED`, `BLOG_VIEWS_FETCH_FAILED`

The shared errors also apply. See [errors.md](002-errors.md).
