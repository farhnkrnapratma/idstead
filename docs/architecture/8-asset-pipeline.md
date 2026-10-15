# 8. Image Pipeline: Encode, Validate, Store, Serve, Clean Up

Images are encoded **in the browser**, validated again on the server, written to R2 through the S3 API, served by fkp-web routes, and cleaned up by fkp-jobs. Markdown bodies are stored separately in Supabase Storage.

```mermaid
sequenceDiagram
    autonumber
    participant B as Admin browser
    participant WW as Web Worker (OffscreenCanvas)
    participant A as fkp-admin route
    participant R2 as R2 (S3 API)
    participant DB as Supabase (service-role)
    participant V as Visitor
    participant W as fkp-web route
    participant J as fkp-jobs (cron 03:17 UTC)

    B->>WW: source file (≤ 10 MB, ≤ 40 MP)
    WW-->>B: encoded set (60 s timeout)
    B->>A: upload (Bearer token)
    A->>A: validate (sizes, magic bytes, WASM WebP decode)
    A->>R2: PUT objects (IfNoneMatch *, then read back + SHA-256 check)
    A->>DB: RPC commits the new version (versions table + pointer row)

    V->>W: GET image URL
    W->>DB: look up active version (identity: db_profiles, banner: db_blog_banner_versions)
    W->>R2: GetObject
    W-->>V: bytes (immutable when versioned)

    J->>DB: rpc db_claim_blog_banner_cleanup / db_claim_identity_cleanup
    J->>R2: delete retired objects
    J->>DB: mark deleted or remove version rows
```

## Asset types

| Asset | Encoder (packages/lib/src) | Server check | R2 key | Served at |
| --- | --- | --- | --- | --- |
| Avatar + icons | `processAvatar.ts` → `workers/avatar.worker.ts`: PNG icon set, `favicon.ico`, SVG, `avatar.webp`, `avatar.avif` (both required) | `validateAvatar.ts`: PNG structure/CRC, ICO directory, WebP/AVIF magic bytes (AVIF checks `ftyp` brand), SVG rebuilt | `identity/{version}/{name}`, shared with the website banner | `/{name}` and `/hero.png`, handled in the web and admin hooks by `serveIdentityAsset()` |
| Blog banner | `processBanner.ts` → `workers/banner.worker.ts`: WebP + AVIF 1280×640, ≤ 500 KiB | `validateBanner.ts` (WebP WASM decode) | `blog/banners/{postUuid}/{version}.{webp,avif}` | `/blog/banners/{public_id}/{version}.{webp,avif}` → `serveBlogBanner()` |
| Markdown image | `processContentImage.ts` → `workers/contentImage.worker.ts`: WebP + optional AVIF, max edge 2400, ≤ 500 KiB | `validateContentImage.ts`: `inspectWebp` + WebP decode; the AVIF file goes through `validateContentImageAvif` (`inspectAvif` box parse, ≤ 500 KiB, same dimensions as the WebP) | `blog/content/{sha256}.{ext}` | `/blog/content/{sha256}.{ext}` → `getContentAsset()` |
| Markdown video | uploaded as-is, content type sniffed | `admin/blog/content-video` route | `blog/content/{sha256}.{mp4,webm}` | `/blog/content/{file}` |
| Website banner | `processSiteBanner.ts` → `workers/siteBanner.worker.ts`: `banner.avif`, `banner.webp` (1280×640), `banner-og.webp` (1200×630) | `validateSiteBanner.ts`: `inspectAvif` / `inspectWebp` with exact dimensions | `identity/{version}/{name}`, shared with the avatar | `/banner.{avif,webp}`, `/banner-og.webp` → `serveIdentityAsset()` |
| CV PDF | generated server-side (`pdfGenerator.ts`) | – | `{filename}` at the bucket root (for example `…-v1.2.3.pdf`), plus a `{filename}.sha256` sidecar | `db_documents.file_url` (CDN URL), streamed by `/v1/cv?output=pdf` |
| Post Markdown | – | – | Supabase Storage `blog-posts`, `posts/{postUuid}/{operationId}.md` | read by page loads and the API |

## Serving rules

- **Identity assets** (`serveIdentityAsset`, `packages/lib/src/server/profileAssets.ts`):
    - One folder per identity version holds the avatar package and the banner package (13 files, `identityAssetNames` in `siteIdentity.ts`). `db_profiles.avatar_version` and `banner_version` always hold the same id.
    - A save that changes only one of them writes the new files into a new folder and copies the unchanged group from the current folder (`copyAssets()`), so every folder is complete.
    - With `?v={uuid}`: served `immutable`.
    - Without `?v`: the current version is read from `db_profiles.avatar_version` (anon client) and served with `s-maxage=60`.
    - When a version object is missing: 307 to the current `?v=`.
    - When no version exists yet: fallback to `PUBLIC_CDN_BASE_URL/{name}`.
- **Blog banners** (`serveBlogBanner`, service-role):
    - Served only when `db_blog_banner_versions.state` is `active` or `retired`.
    - The response is `immutable`. Errors are `no-store`.
- **Content assets** are content-addressed (SHA-256), so they are always `immutable`.

## Cleanup

- **`cleanupBlogAssets`** (`blogBannerStorage.ts`):
    - Banners: claims retired banner versions, deletes the `.webp` and `.avif` objects, and sets `state='deleted'`. On failure it records `cleanup_error`.
    - Markdown: removes orphaned files listed in `db_post_storage_cleanup` that are more than 24 h old and no longer referenced by `db_posts.storage_path`.
- **`cleanupAssets`** (`profileAssets.ts`): claims retired identity versions, deletes `identity/{id}/*`, then deletes the version row.
- **Callers:** the jobs cron, admin `posts` / `posts/cleanup`, `profile` / `profile/cleanup`, and `data/delete-all`.

## Source

- `packages/lib/src/process*.ts`, `packages/lib/src/workers/*.worker.ts`
- `packages/lib/src/server/validate*.ts`, `profileAssets.ts`, `blogBannerStorage.ts`, `blogBannerResponse.ts`, `blogContentStorage.ts`
- `packages/lib/src/blogBanner.ts`, `blogContentImage.ts`, `siteIdentity.ts`
- `apps/web/src/routes/blog/banners/[postId]/[file]/+server.ts`, `blog/content/[file]/+server.ts`
- `apps/admin/src/routes/api/internal/admin/{profile,blog/content-image,blog/content-video}/+server.ts`
