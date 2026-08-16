# Pre-Deployment Checklist (Cloudflare Preview / `develop` Branch)

Checklist ini digunakan sebelum melakukan push/deploy ke branch `develop` (Cloudflare Pages Preview tier).

---

## 1. 🏗️ Build & Code Correctness Gates

- [x] **Type Checking**: `bun run check` lulus dengan 0 errors (`svelte-check` valid).
- [x] **Code Style & Formatting**: `bun run format` (Prettier) selesai tanpa perubahan yang tertunda.
- [x] **Linter**: `bun run lint` (ESLint) lulus dengan 0 errors.
- [x] **Production Build Verification**: `bun run build:preview` berhasil mem-bundle aplikasi ke `.svelte-kit/cloudflare` via `@sveltejs/adapter-cloudflare`.

---

## 2. 🔐 Konfigurasi Environment & Secrets (Cloudflare Dashboard - Preview Tier)

Pastikan variabel lingkungan pada Cloudflare Pages Preview Tier telah sesuai:

- [x] `PUBLIC_SUPABASE_URL`: URL project Supabase.
- [x] `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Anon publishable key Supabase.
- [x] `SUPABASE_SERVICE_ROLE_KEY`: Service role secret (server-only).
- [x] `PUBLIC_TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET`: Dummy testing key Turnstile untuk preview environment (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
- [x] `PUBLIC_CDN_BASE_URL`: `https://cdn.fkp.my.id` (**tanpa trailing slash `/`**).
- [x] `PUBLIC_SENTRY_ENVIRONMENT`: `preview`.
- [x] `PUBLIC_SENTRY_DSN` & `SENTRY_AUTH_TOKEN`: Konfigurasi Sentry terpasang.
- [x] `IP_SALT`: Salt untuk anonymized hashing IP.
- [x] `CLOUDFLARE_API_TOKEN`: Token autentikasi Wrangler/Workers AI.

---

## 3. 🌐 Cloudflare Bindings (`wrangler.jsonc`)

- [x] **`AI` Binding**: Menggunakan `workers-ai` dengan `remote: true` untuk moderasi komentar blog via Llama Guard 3.
- [x] **`API_RATE_LIMITER` Binding**: Rate limit 60 request/menit per IP.

---

## 4. 🔤 CDN & Asset Statis

- [x] **4 File Font New Computer Modern (OTF)** aktif di CDN dengan status `200 OK`:
  - `https://cdn.fkp.my.id/fonts/New_Computer_Modern/NewCM10-Regular.otf`
  - `https://cdn.fkp.my.id/fonts/New_Computer_Modern/NewCM10-Italic.otf`
  - `https://cdn.fkp.my.id/fonts/New_Computer_Modern/NewCM10-Bold.otf`
  - `https://cdn.fkp.my.id/fonts/New_Computer_Modern/NewCM10-BoldItalic.otf`
- [x] **Pencegahan Double Slash**: `transformPageChunk` di `hooks.server.ts` otomatis menormalkan `${cdn}//` menjadi `${cdn}/`.
- [x] **Cross-Origin Manifest**: `<link rel="manifest" ... crossorigin="anonymous">` di `app.html`.

---

## 5. 🛡️ Security & Content Security Policy (`_headers`)

- [x] **CSP Directives**:
  - `script-src`: `'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://*.googletagmanager.com`
  - `style-src`: `'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com`
  - `font-src`: `'self' https://fonts.gstatic.com https://cdn.fkp.my.id https://*.fkp.my.id`
  - `img-src`: `'self' data: blob: https://*.supabase.co https://cdn.fkp.my.id https://*.fkp.my.id https://www.googletagmanager.com https://*.google-analytics.com`
  - `connect-src`: `'self' https://*.supabase.co https://challenges.cloudflare.com https://api.github.com https://*.sentry.io https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com`
  - `frame-src`: `'self' https://challenges.cloudflare.com https://www.googletagmanager.com`
  - `frame-ancestors`: `'none'`
- [x] **Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 6. ✨ Fitur UI & Aksesibilitas

- [x] **Theme Switcher 3-State**: Siklus instan `Auto` ➔ `Light` ➔ `Dark` ➔ `Auto` dengan animasi rotasi ikon, notifikasi toast, dan tooltip dinamis.
- [x] **Content Font Switcher**: Pilihan font (`Sans`, `Serif (New Computer Modern)`, `Mono`) aktif pada halaman Legal (Privacy, Terms, Security) dan Read Blog Post, dengan persistensi di `localStorage`.
- [x] **Click-Anywhere Outside Dismissal**: Menutup dialog Accessibility dan Font Switcher dengan mengklik di mana saja di luar container.
- [x] **Posisi Dialog & Tooltip Aman**: Dialog Accessibility dan Font Switcher di-anchor ke `right-0` dengan `tooltipAlign="right"` agar tidak terpotong di tepi layar.
- [x] **Custom Glass Tooltip**: Native browser tooltip (`title`) dinonaktifkan dan diganti dengan custom tooltip ringkas pada seluruh tombol icon-only.
- [x] **Penyeragaman Tipografi Prose**: Warna heading (`var(--color-text-primary)`), body (`var(--color-text-secondary)`), margin, table, blockquote, dan callout 100% konsisten antara blog dan halaman legal.
- [x] **GradientWaves Defaults**: Nilai warna gelombang dikembalikan ke default `#5227FF`, `#FF9FFC`, `#FFFFFF`.

---

## 7. 🌿 Git & Deployment Workflow

- [x] **Target Branch**: `develop` (Preview environment).
- [x] **Signoff Commit**: Semua commit ditandatangani dengan `-s` (`git commit -s ...`).
- [x] **Knowledge Graph**: AST synchronized via `graphify update .`.
