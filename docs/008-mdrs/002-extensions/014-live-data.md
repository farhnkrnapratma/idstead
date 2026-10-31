# Live data

Expressions can read data from the site's own database through the `api.v1.*` root: in `${…}`, inside `:::define`, and in [conditionals](016-conditionals.md). Values are fetched on the server while the page is rendered, so the text is always current without a client-side request.

In `${…}`, live data needs a document that starts with a non-empty [`:::define`](013-variables.md) block; without one, `${…}` stays plain text. `:::if` conditions can read `api.v1.*` without a `:::define` block.

```mdrs
:::define
author: api.v1.author.profile.name
post_count: api.v1.blog.length
:::

Written by **${author}**. ${post_count} posts published so far.

${if post_count > 0}Latest post: [${api.v1.blog[0].title}](/blog/${api.v1.blog[0].slug})${endif}
```

The last line is an inline conditional: the link only renders, and `api.v1.blog[0]` is only read, when at least one post is published.

## `api.v1.author`

The author profile, shaped like the public API's `GET /v1/author` response:

| Path                    | Contains                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `api.v1.author.profile` | Name, bio, avatar, site URL and other profile fields, plus `email` |
| `api.v1.author.resume`  | Resume entries                                                     |
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
| `api.v1.blog` | The 20 most recent published posts, newest first. Each has `id` (the public 64-hex ID), `title`, `slug`, `excerpt`, `collaborators`, `created_at`, `updated_at` |
| `api.v1.blog.length` | How many of those posts there are (at most 20) |
| `api.v1.blog[0].title` | A field of one post |
| `api.v1.blog["my-post-slug"]` | One published post by slug: `id` (the public ID), `title`, `slug`, `pinned`, `created_at`, `updated_at`, `excerpt`, `tags`, `collaborators` and `content` |

```mdrs
:::define
post: api.v1.blog["hello-world"]
:::

Read [${post.title}](/blog/hello-world), first published ${post.created_at}.
```

`api.v1.blog["slug"]` reads the post body from its markdown file in R2. Posts without a markdown file return an empty `content`.

## `api.v1.analytics`

The analytics setting chosen in the admin, shaped like the public API's `GET /v1/analytics` response. It never contains IDs, tokens or script URLs.

| Path | Contains |
| --- | --- |
| `api.v1.analytics.enabled` | `true` when a provider is set |
| `api.v1.analytics.provider` | `none`, `ga4`, `gtm`, `umami`, `plausible` or `cloudflare` |
| `api.v1.analytics.name` | The provider's display name, such as `Google Analytics 4` or `None` |
| `api.v1.analytics.cookies` | `true` when the provider sets cookies, so the site asks for consent |

```mdrs
:::if api.v1.analytics.cookies
We use ${api.v1.analytics.name}, which sets cookies only after you agree in the cookie banner.
:::elif api.v1.analytics.enabled
We use ${api.v1.analytics.name}, which sets no cookies.
:::else
This site uses no analytics.
:::endif
```

Legal pages use it to keep the privacy policy in line with the setting; see [Conditionals](016-conditionals.md#examples-with-analytics).

## Rules

- Only `v1` exists, with the resources the site registers: `author`, `blog` and `analytics` (`Unknown api.v1 resource 'x' (supported: author, blog, analytics)`). `@mdrs/core` itself names no resource; it lists whatever the resolvers passed to it provide.
- An unknown slug gives `api.v1.blog['x'] does not resolve to a published post`. In the examples, `hello-world` stands for a real slug.
- Indexing past the end of the list fails with `Index [0] is out of range`, so `api.v1.blog[0]` errors (and blocks saving) while no post is published. Guard it with a conditional, as in the first example: a branch's `${…}` is only evaluated when the branch is chosen ([Conditionals](016-conditionals.md)).
- Rendering without resolvers (for example in tests) gives `Database access is unavailable in this context.`
- Internal database IDs are never exposed: posts carry their public ID as `id`.
- Within one render, `api.v1.author`, `api.v1.analytics`, the `api.v1.blog` list and each `api.v1.blog['slug']` are fetched once and reused, however often they are referenced.
- Published posts show live data as of their last render: when the post was saved, when any post was last published or unpublished, or the daily refresh. It can therefore be up to a day old. The admin preview always renders fresh.

Errors render the same `[define error]` marker as other [variables](013-variables.md#errors), and block saving.

Source: `packages/mdrs/core/src/define/evaluate.ts` (`evaluateReference`, `unavailableResolvers`, `ApiRegistry`), `packages/lib/src/server/api/analytics.ts` (`analyticsData`), `packages/lib/src/mdrsResolvers.ts` (`createMdrsResolvers`), `packages/lib/src/server/mdrsData.ts` (`mdrsResolvers`, `mdrsLoaders`).
