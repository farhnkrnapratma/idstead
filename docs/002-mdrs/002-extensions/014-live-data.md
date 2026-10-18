# Live data

Expressions can read data from the site's own database through the `api.v1.*` root, both in `${…}` and inside `:::define`. Values are fetched on the server while the page is rendered, so the text is always current without a client-side request.

Like every other expression, live data needs a document that starts with a non-empty [`:::define`](013-variables.md) block; without one, `${…}` stays plain text.

```mdrs
:::define
author: api.v1.author.profile.name
post_count: api.v1.blog.length
:::

Written by **${author}**. ${post_count} posts published so far.

[Latest post: [${api.v1.blog[0].title}](/blog/${api.v1.blog[0].slug})].${post_count > 0}
```

The last line is conditional text: the link only renders, and `api.v1.blog[0]` is only read, when at least one post is published.

## `api.v1.author`

The author profile, shaped like the public API's `GET /v1/author` response:

| Path                    | Contains                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `api.v1.author.profile` | Name, bio, avatar, site URL and other profile fields, plus `email` |
| `api.v1.author.cv`      | CV entries                                                         |
| `api.v1.author.funding` | Funding links                                                      |
| `api.v1.author.contact` | Contact information                                                |
| `api.v1.author.skills`  | Skills, grouped                                                    |
| `api.v1.author.socials` | Social profiles                                                    |

```mdrs
:::define
profile: api.v1.author.profile
:::

Contact me at ${profile.email}.
I list ${api.v1.author.socials.length} social profiles.
```

## `api.v1.blog`

| Path | Contains |
| --- | --- |
| `api.v1.blog` | The 20 most recent published posts, newest first. Each has `id` (the public 64-hex ID), `title`, `slug`, `excerpt`, `summary`, `tldr`, `collaborators`, `created_at`, `updated_at` |
| `api.v1.blog.length` | How many of those posts there are (at most 20) |
| `api.v1.blog[0].title` | A field of one post |
| `api.v1.blog["my-post-slug"]` | One published post by slug, with all of its columns (`id` is the public ID) and `content` |

```mdrs
:::define
post: api.v1.blog["hello-world"]
:::

Read [${post.title}](/blog/hello-world), first published ${post.created_at}.
```

`api.v1.blog["slug"]` reads the post body from the `storage_path` file in Supabase Storage. Posts without a `storage_path` return an empty `content`.

## Rules

- Only `v1` exists, and only `author` and `blog` resources (`Unknown api.v1 resource 'x' (supported: author, blog)`).
- An unknown slug gives `api.v1.blog['x'] does not resolve to a published post`. In the examples, `hello-world` stands for a real slug.
- Indexing past the end of the list fails with `Index [0] is out of range`, so `api.v1.blog[0]` errors (and blocks saving) while no post is published. Guard it with conditional text, as in the first example: the `${…}` inside `[…].${…}` is only evaluated when the condition is true ([Variables](013-variables.md#conditional-text-textcondition)).
- Rendering without resolvers (for example in tests) gives `Database access is unavailable in this context.`
- Internal database IDs are never exposed: posts carry their public ID as `id`.
- The old `db.*` root has been removed; using it gives a message pointing to `api.v1.*`.
- Every reference to `api.v1.author` fetches the whole profile again. Read it once into a `:::define` variable when you use it several times.

Errors render the same `[define error]` marker as other [variables](013-variables.md#errors), and block saving.

Source: `packages/mdrs/src/define.ts` (`evaluateReference`, `unavailableResolvers`), `packages/lib/src/mdrsResolvers.ts` (`createMdrsResolvers`, `resolveAuthorPath`, `resolveBlogPath`).
