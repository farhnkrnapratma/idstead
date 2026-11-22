# Live data: `get()`

`get(url, path)` reads one value from a JSON API while the page is rendered. It works in every expression: in `:::define` values, in `${…}`, in [conditionals](016-conditionals.md) and in `? :`. Values are fetched on the server, so readers get finished HTML without a client-side request.

In `${…}`, `get()` needs a document that starts with a non-empty [`:::define`](013-variables.md) block; without one, `${…}` stays plain text. `:::if` conditions can call `get()` without a `:::define` block.

```mdrs
:::define
author: get('https://api.my-site.example/v1/author', '.profile.name')
city: get('https://api.my-site.example/v1/author', '.profile.city')
:::

Written by **${author}** in ${city}.
```

## Arguments

| Argument | Value |
| --- | --- |
| `url` | An `https://` URL without a username or password. The response must have a JSON content type (`application/json` or `…+json`). |
| `path` | A jq-style path to one value in the response. It starts with `.`. |

Both arguments are expressions, so they can be built from variables: ``get(`${api}/author`, '.profile.name')``.

## Paths

Paths follow jq's syntax for selecting a value:

| Path                        | Selects                                    |
| --------------------------- | ------------------------------------------ |
| `.name`                     | The `name` property                        |
| `.profile.name`             | A nested property                          |
| `.items[0]` or `.items.[0]` | The first item of an array                 |
| `.items[0].title`           | A property of an array item                |
| `.["odd-key"]`              | A property whose name is not an identifier |

Given `{ "foo": { "bar": true, "baz": 123 } }`, `.foo.baz` gives `123` and `.foo.bar` gives `true`.

## Values

Each call returns exactly one value, which must be a string, a number or a boolean. Strings and numbers print as text. Numbers keep working in arithmetic and comparisons, and booleans drive conditions directly:

```mdrs
:::if get('https://api.my-site.example/v1/analytics', '.cookies')
This site sets analytics cookies only after you agree in the cookie banner.
:::elif get('https://api.my-site.example/v1/analytics', '.enabled')
This site measures visits with ${get('https://api.my-site.example/v1/analytics', '.name')}, which sets no cookies.
:::else
This site uses no analytics.
:::endif
```

An object, array or `null` at the path is an error: select a scalar inside it instead.

## Rules

- Within one render, each URL is fetched once and its response is reused, however often it is called and with whatever path.
- A document can call `get()` with at most 10 different URLs.
- The response must be a 2xx status with a JSON content type, at most 256 KB, and arrive within 5 seconds. Redirects are not followed.
- Requests send no cookies or credentials, so only public endpoints work. `localhost`, `*.localhost`, private, loopback, link-local and shared IPv4 ranges, and IPv6 address literals are rejected before any request.
- Published posts show the value as of their last render: when the post was saved, when any post was last published or unpublished, or the daily refresh. It can therefore be up to a day old. Legal pages fetch on every request, and the admin preview always fetches fresh, through the admin host.

## Errors

Errors render the same `[define error]` marker as other [variables](013-variables.md#errors), and block saving.

| Message | Cause |
| --- | --- |
| `get() URL 'x' is not a valid URL` / `must use https` / `must not contain credentials` / `must point to a public host` | The URL is rejected before any request |
| `get() path 'x' must start with '.'` / `Invalid get() path 'x' at position n` | The path is not jq syntax |
| `Property 'x' does not exist` / `Index [n] is out of range` | The response has no value at the path |
| `get('…', '…') must resolve to a string, number or boolean` | The path selects an object, array or `null` |
| `get() received HTTP 404 from …` / `get() requires a JSON response from …` / `get() received invalid JSON from …` | The response is not usable JSON |
| `A document can call get() with at most 10 different URLs` | Too many different URLs |
| `Network access is unavailable in this context.` | The host rendered without a fetcher |

Source: `packages/mdrs/core/src/define/evaluate.ts` (`evaluateGet`), `packages/mdrs/core/src/define/jsonPath.ts`, `packages/mdrs/core/src/define/fetcher.ts` (`documentFetcher`, `checkGetUrl`), `packages/lib/src/server/mdrsFetch.ts` (`fetchJson`).
