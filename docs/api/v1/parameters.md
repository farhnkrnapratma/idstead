# v1 Parameters

Every v1 endpoint parses its query string with `parseApiParams(url, allowed)` (`packages/lib/src/server/api/params.ts`). That gives every endpoint the same rules.

## Names and aliases

| Parameter  | Alias | Kind   | Values                                                        |
| ---------- | ----- | ------ | ------------------------------------------------------------- |
| `id`       | –     | single | post ID, unique ID prefix (7 or more hex characters), or slug |
| `field`    | `f`   | multi  | `profile`, `contact`, `cv`, `funding`, `skills`, `socials`    |
| `output`   | `o`   | single | `json`, `md`, `txt`, `pdf` (each endpoint accepts a subset)   |
| `query`    | `q`   | single | search text                                                   |
| `page`     | `p`   | single | 1-based page number                                           |
| `limit`    | `n`   | single | results per page                                              |
| `checksum` | `c`   | single | `true` or `false`                                             |

Which endpoint accepts which parameter:

| Endpoint            | Accepted                                 |
| ------------------- | ---------------------------------------- |
| `/v1`               | `output`                                 |
| `/v1/blog`          | `id`, `query`, `page`, `limit`, `output` |
| `/v1/blog/content`  | `id`, `output`                           |
| `/v1/blog/comments` | `id`, `limit`                            |
| `/v1/blog/views`    | `id`                                     |
| `/v1/author`        | `field`, `output`, `checksum`            |
| `/v1/cv`            | `output`, `checksum`                     |
| `/v1/search`        | `query`, `page`, `limit`                 |

`/v1/openapi.json` and `/v1/openapi.yaml` ignore the query string.

## Rules

- **Unknown parameters:** a key the endpoint does not accept returns `400 UNKNOWN_PARAMETER`. The `details` field lists the accepted parameters.
- **Name plus alias:** using both forms of one parameter (`?query=a&q=b`) returns `400 PARAM_CONFLICT`. Repeating a single-value parameter also returns `PARAM_CONFLICT`.
- **Multi-value (`field`):**
    - Values may be comma-separated, repeated, or both: `?f=profile,cv` is the same as `?f=profile&f=cv`.
    - Values are trimmed, lower-cased and de-duplicated.
    - An empty value (`?f=`) means "all sections".
- **Single values** are trimmed. `output` and `checksum` are compared case-insensitively.
- **Numbers (`page`, `limit`):** anything that is not a positive integer falls back to the endpoint default. Values above the maximum are clamped. `page` has no maximum, and a page past the end returns empty `data`, not an error.

| Endpoint            | `limit` default | `limit` max |
| ------------------- | --------------- | ----------- |
| `/v1/blog`          | 20              | 100         |
| `/v1/blog/comments` | 50              | 100         |
| `/v1/search`        | 6               | 20          |

- **Booleans (`checksum`):** only `true` or `false` are accepted. Anything else returns `400 PARAM_INVALID`.

## Output negotiation

`resolveOutput()` picks the representation:

1. If `output` is present, it wins. A value the endpoint does not offer returns `400 OUTPUT_UNSUPPORTED`, and `details` lists the supported values.
2. Otherwise the `Accept` header is checked, in this order, among the outputs the endpoint offers:
    - `text/markdown` or `text/x-markdown` gives `md`;
    - `text/plain` gives `txt`;
    - `application/json` gives `json`.
3. Otherwise the endpoint default applies.

The `Accept` check is a plain substring match, so q-values are ignored and `*/*` falls through to the default.

## Post IDs

Every post has an immutable public ID: 64 lowercase hex characters (`db_posts.public_id`), returned as `id`. Anywhere a post is referenced, `id` accepts:

1. the full 64-hex ID;
2. an exact slug;
3. a unique hex prefix of 7 to 63 characters, like a git commit hash.

Resolution (`findPost()` in `packages/lib/src/server/postLookup.ts`) runs in that order, over published posts only. An exact slug always wins over a prefix.

| Situation | Result |
| --- | --- |
| `id` is missing or empty where it is required | `400 BLOG_POST_ID_REQUIRED` |
| Not a hex ID and not a valid slug | `400 BLOG_POST_ID_INVALID` (`details` echoes up to 120 characters) |
| No published post matches | `404 BLOG_POST_NOT_FOUND` |
| The prefix matches more than one post | `409 BLOG_POST_ID_AMBIGUOUS` |

The value is trimmed and lower-cased before matching. Path-style post URLs such as `/v1/blog/{id}` do not exist and return `404 NOT_FOUND`.
