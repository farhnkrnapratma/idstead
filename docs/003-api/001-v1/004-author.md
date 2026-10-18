# v1 Author and CV

Handler: `getAuthor` in `packages/lib/src/server/api/author.ts`. The data comes from the author profile tables (see [architecture/9](../../001-architecture/009-database-schema.md#author-profile)).

## `GET /v1/author`

| Parameter | Default | Notes |
| --- | --- | --- |
| `field` / `f` | all sections | any of `profile`, `contact`, `cv`, `funding`, `skills`, `socials`, comma-separated or repeated |
| `output` / `o` | `json` | `json` or `md`; the CV file outputs `pdf`, `sha256`, `sha512`, `md5`, `b2`, `asc`, `sig` and `zip` only when `field` is exactly `cv` |
| `checksum` / `c` | `true` | only valid with `output=pdf` or `output=zip` |

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

- **Internal keys removed:** `id`, `authorId`, `author_id`, `sortOrder`, `sort_order`, `revision`, `avatarVersion`, `bannerVersion`, `manifestSettings`, `icon`, `updatedAt`, `firstName`, `lastName`, `email`. The profile `email` is then added back on purpose.
- **Empty values dropped:** `null`, empty arrays, empty objects and empty `description` values.
- **Ended entries:** `currentlyIn` is dropped from entries that have an end date.

`output=md` renders the same data as Markdown (`generateAuthorMarkdown`). An unknown section returns `400 AUTHOR_FIELD_INVALID`.

```sh
curl "https://api.fkp.my.id/v1/author?f=profile,skills"
curl "https://api.fkp.my.id/v1/author?f=profile,skills&o=md"
```

## `GET /v1/cv`

`/v1/cv` gives exactly the same response as `/v1/author?field=cv`, byte for byte, with no redirect. It takes `output` (`json` by default, `md`, or a CV file output) and `checksum`.

As JSON or Markdown, `cv.document` describes the active PDF (`null` when there is none or its metadata cannot be read): `filename`, `version`, `updatedAt`, `checksums`, `signature`, `files` and `publicKey`.

### CV files

The CV file outputs (`CV_FILE_OUTPUTS` in `packages/lib/src/server/api/params.ts`) are available only when the request is for the CV alone. Each downloads one file as an attachment:

| `output` | File | `Content-Type` |
| --- | --- | --- |
| `pdf` | `<name>`, fetched from the active `db_documents.file_url` | `application/pdf` |
| `sha256`, `sha512`, `md5`, `b2` | `<name>.<output>` in coreutils format, built from the stored checksums (or read from storage when they are missing) | `text/plain; charset=utf-8` |
| `asc` | `<name>.asc`, the ASCII-armored detached signature | `application/pgp-signature` |
| `sig` | `<name>.sig`, the binary detached signature | `application/octet-stream` |
| `zip` | the verification bundle (`cvBundleFilename`), read from storage or assembled on the fly | `application/zip` |

`asc` and `sig` return `404 CV_SIGNATURE_NOT_FOUND` unless the document is signed by the active OpenPGP key. `zip` returns `404 CV_BUNDLE_NOT_FOUND` when the stored bundle is missing and cannot be assembled (no stored checksums, or a missing signature file).

Headers:

- `Content-Disposition: attachment; filename="<name>"`, where quotes, backslashes and CR/LF are stripped from the stored filename and the default is `cv.pdf`
- `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate`
- With `pdf` or `zip`, `checksum=true` (the default) adds `Repr-Digest` (RFC 9530) with `sha-256` and `sha-512`, and `X-Checksum-SHA256: <hex>` when SHA-256 is included. `Want-Repr-Digest` narrows or orders the algorithms, and the response then carries `Vary: Want-Repr-Digest`. `checksum=false` omits these headers.

The worker does **not** add an ETag to CV file responses.

```sh
curl -OJ "https://api.fkp.my.id/v1/cv?o=pdf"
curl -I  "https://api.fkp.my.id/v1/cv?o=pdf&c=false"
curl -OJ "https://api.fkp.my.id/v1/cv?o=zip"
curl -OJ "https://api.fkp.my.id/v1/cv?o=sig" && gpg --verify CV-*.pdf.sig
```

## Errors

| Code | When |
| --- | --- |
| `AUTHOR_FIELD_INVALID` (400) | unknown `field` value |
| `OUTPUT_UNSUPPORTED` (400) | a CV file `output` with any field set other than `cv` alone |
| `PARAM_INVALID` (400) | `checksum` is not `true` or `false` |
| `CV_CHECKSUM_REQUIRES_PDF` (400) | `checksum` with an `output` other than `pdf` or `zip` |
| `CV_DOCUMENT_NOT_FOUND` (404) | no active CV, or it has no file URL |
| `CV_SIGNATURE_NOT_FOUND` (404) | `asc` or `sig` while the active CV is unsigned |
| `CV_BUNDLE_NOT_FOUND` (404) | `zip` before the bundle was built, when it cannot be assembled |
| `AUTHOR_FETCH_FAILED` (500) | a section failed to load |
| `CV_METADATA_FETCH_FAILED` (500) | the active document, or the OpenPGP key for `asc`, `sig` or `zip`, could not be read |
| `CV_FETCH_FAILED` (502) | a CV file could not be fetched |

The shared errors also apply. See [errors.md](002-errors.md).
