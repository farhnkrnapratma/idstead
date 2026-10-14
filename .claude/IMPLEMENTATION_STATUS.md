# AVIF + WebP Images Implementation Status

**Updated:** 2026-10-14 14:30 GMT+7  
**Branch:** feature/admin-parity  
**Status:** Phase A (Image Rendering) ✓ COMPLETE | Phase B (Blog Banner) ✓ MOSTLY COMPLETE

## ✓ Completed in This Session

### A. Shared Image Rendering (100%)

- ✓ `ImageWithSkeleton.svelte` updated to render `<picture>` with AVIF/WebP sources
- ✓ Added `ImageSource` interface (srcset, type) in `blogBanner.ts`
- ✓ Added `avatarSources()` helper in `siteIdentity.ts`
- ✓ Added `bannerSources()` helper in `blogBanner.ts`
- ✓ Installed `@jsquash/avif@*` dependency

### B. Blog Banner AVIF+WebP (90%)

- ✓ `bannerRaster.ts`: Split `encodeBanner()` → `encodeWebpBanner()` + `encodeAvifBanner()`
- ✓ `rasterBanner()` now returns `{ webp, avif, width, height }`
- ✓ `processBanner.ts` returns both formats
- ✓ `BannerImageUpload.svelte` accepts and displays both sizes
- ✓ `BannerChange` type updated to carry `{ webp, avif }` blobs
- ✓ `PostEditor.svelte` submits both `banner` and `bannerAvif` form fields
- ✓ `blogPostInput.ts` validates and tracks both formats
- ✓ `bannerKey()`, `putBanner()`, `getBannerObject()` parameterized for both formats
- ✓ `serveBlogBanner()` detects and serves both `.webp` and `.avif`
- ✓ `cleanupBlogAssets()` deletes both format files
- ✓ TypeScript compilation: **0 errors**

## Next Steps

See full implementation plan at `/pasted-content-id-108b-picture-source-jiggly-lightning.md`.

**Immediate priorities:**

1. Apply Supabase migration for dual banner storage
2. Update blog banner tests (regex + API tests)
3. Avatar AVIF+WebP support (mirror blog changes)
4. Website banner feature
5. OG/SEO tag updates
6. Backfill script for existing images
