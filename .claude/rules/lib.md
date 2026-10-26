---
paths:
    - packages/lib/**
---

# Shared library (`packages/lib`)

Every app imports shared code as `#lib/...`. Each app's `package.json` maps `#lib/*` to `@idstead/lib/*`, and `@idstead/lib` exports `./*` from `src/*`, so the import paths are identical everywhere. Svelte apps type-check `packages/lib/src` through their own `tsconfig.json`; lib code must therefore type-check in both web and admin (no app-specific typed `resolve()` routes in lib).

- `src/components/` — the components both apps use (CommentThread, BrandIcon); `src/article/ArticleMeta.svelte`. UI primitives live in `@idstead/ui`; components used by only one app live in that app (below).
- `src/global.css` — the app stylesheet entry: it imports `@idstead/ui/styles/global.css` (Tailwind, fonts, tokens), scans lib with `@source './'` and adds `mdrs.css`. Apps import `#lib/global.css` in their root layout; lib component `<style>` blocks `@reference` it relatively.
- `src/server/` — server-only helpers: `apiError`, `apiEnvelope` (public `{error:{...}}` wrapping), `rateLimit`, `r2` (the `ASSET_BUCKET` R2 binding), `workerEnv` (Cloudflare bindings through `cloudflare:workers`; `event.platform` is always undefined with adapter-cloudflare 8), `csp`, `subscriberBroadcast`, `newsletterQueue`, and `api/` (API handlers).
- `src/apiConfig.ts` — `apiUrl()`/`apiBaseUrl()` for links to the API host from web pages.
