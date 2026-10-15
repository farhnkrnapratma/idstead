# v1 Author and CV

Handler: `getAuthor` in `packages/lib/src/server/api/author.ts`. The data comes from the author profile tables (see [architecture/9](../../architecture/9-database-schema.md#author-profile)).

## `GET /v1/author`

| Parameter | Default | Notes |
| --- | --- | --- |
| `field` / `f` | all sections | any of `profile`, `contact`, `cv`, `funding`, `skills`, `socials`, comma-separated or repeated |
| `output` / `o` | `json` | `json` or `md`; `pdf` only when `field` is exactly `cv` |
| `checksum` / `c` | `true` | only valid with `output=pdf` |

The response has one key per requested section:

| Section | Shape |
| --- | --- |
| `profile` | `{name, pronunciation?, username, email, headline, jobTitle, bio, avatar, city, postalCode, country, siteUrl, …}`. Keys come in this order. `email` is the public contact address. `avatar` has its `?v=` cache-buster removed. |
| `contact` | `[{platform, displayValue, href, description?}]` |
| `cv` | `{experience: [{title, type, company, startMonth, startYear, endMonth?, endYear?, currentlyIn?, location, locType, description?}], education: [{institution, degree, field, startMonth, startYear, endMonth?, endYear?, currentlyIn?, grade, description?}]}` |
| `funding` | `[{platform, displayValue, url, description}]` |
| `skills` | `[{category, items: string[]}]` |
| `socials` | `[{platform, url, description?}]` |

Before a response is sent, `sanitizePublicApiData()` (`packages/lib/src/authorApi.ts`) cleans it:

- **Internal keys removed:** `id`, `authorId`, `author_id`, `sortOrder`, `sort_order`, `revision`, `avatarVersion`, `manifestSettings`, `icon`, `updatedAt`, `firstName`, `lastName`, `email`. The profile `email` is then added back on purpose.
- **Empty values dropped:** `null`, empty arrays, empty objects and empty `description` values.
- **Ended entries:** `currentlyIn` is dropped from entries that have an end date.

`output=md` renders the same data as Markdown (`generateAuthorMarkdown`). An unknown section returns `400 AUTHOR_FIELD_INVALID`.

```sh
curl "https://api.fkp.my.id/v1/author?f=profile,skills"
curl "https://api.fkp.my.id/v1/author?f=profile,skills&o=md"
```

## `GET /v1/cv`

`/v1/cv` gives exactly the same response as `/v1/author?field=cv`, byte for byte, with no redirect. It takes `output` (`json` by default, `md`, `pdf`) and `checksum`.

### PDF download (`output=pdf`)

Headers:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="<name>"`, where quotes, backslashes and CR/LF are stripped and the default is `cv.pdf`
- `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate`
- `checksum=true` (the default) adds `Repr-Digest: sha-256=:<base64>:` (RFC 9530) and `X-Checksum-SHA256: <hex>`. `checksum=false` omits both.

The worker does **not** add an ETag to PDF responses.

The PDF is fetched from the active `db_documents.file_url`.

```sh
curl -OJ "https://api.fkp.my.id/v1/cv?o=pdf"
curl -I  "https://api.fkp.my.id/v1/cv?o=pdf&c=false"
```

## Errors

| Code                             | When                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `AUTHOR_FIELD_INVALID` (400)     | unknown `field` value                                 |
| `OUTPUT_UNSUPPORTED` (400)       | `output=pdf` with any field set other than `cv` alone |
| `PARAM_INVALID` (400)            | `checksum` is not `true` or `false`                   |
| `CV_CHECKSUM_REQUIRES_PDF` (400) | `checksum` without `output=pdf`                       |
| `CV_DOCUMENT_NOT_FOUND` (404)    | no active CV, or it has no file URL                   |
| `AUTHOR_FETCH_FAILED` (500)      | a section failed to load                              |
| `CV_METADATA_FETCH_FAILED` (500) | the active document could not be read                 |
| `CV_FETCH_FAILED` (502)          | the PDF could not be fetched                          |

The shared errors also apply. See [errors.md](errors.md).
