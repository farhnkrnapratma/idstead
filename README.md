<!-- @format -->
<p align="center">
  <a href="https://fkp.my.id/">
    <img src="https://cdn.fkp.my.id/android-chrome-512x512.png" alt="Farhan Kurnia Pratama" width="200" height="200">
  </a>
</p>
<h1 align="center">👋 Welcome to my personal website project!</h1><br/>
<h3 align="center">Linux/Unix, AI, Open-Source Software, and Cybersecurity.</h3>
<p align="center">Security-focused Software Engineer with expertise in Linux/Unix, AI, and Open-Source Software, dedicated to building reliable, maintainable, and privacy-centric systems.</p>
<p align="center">
  <a href="https://fkp.my.id/">Home</a>
  ·
  <a href="https://fkp.my.id/#projects">Projects</a>
  ·
  <a href="https://fkp.my.id/#blog">Blog</a>
  ·
  <a href="https://fkp.my.id/#cv">CV</a>
  ·
  <a href="https://fkp.my.id/#funding">Funding</a>
  ·
  <a href="https://fkp.my.id/#contact">Contact</a>
</p>

Built with [SvelteKit](https://svelte.dev/), [Tailwind CSS](https://tailwindcss.com/), and [Supabase](https://supabase.com/), deployed on [Cloudflare Pages](https://pages.cloudflare.com/).

## Get Started

### Prerequisites

Most of this project's tooling (formatting, linting, type-checking, building, etc.) and package management is handled with Bun. Install Bun and you're ready to start hacking. You can install Bun by running this command:

- Linux & macOS

```sh
curl -fsSL https://bun.sh/install | sh
```

- Windows

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

For more information about Bun, visit the official [Bun website](https://bun.com/).

Alternatively, if you are using Nix/NixOS with flakes enabled, you can enter the development shell by running this command:

```nix
nix develop
```

### Install Dependencies

Before that, you need to clone or fork this repository (make sure you have [Git](https://git-scm.com/install/linux) installed). Simply run:

```
git clone https://github.com/farhnkrnapratma/www.git
cd <path_to_www>
```

Then install all dependencies before you start hacking by running this command:

```sh
bun install
```

### Configure Environment Variables

Copy the example env file and fill in the values (Supabase, Cloudflare R2, Sentry credentials):

```sh
cp .env.example .env
```

The dev server will not start correctly without a valid `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` at minimum.

> **Dev server won't start / crashes immediately?** This is almost always a missing or invalid `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`. Double-check those two values first before looking anywhere else.

And that's it, you're ready to start hacking!

### Start Development Server

I use [Vite](https://vite.dev/) as the build tool and development server. You can start the development server by running this command:

```sh
bun run dev [--host]
```

You can omit `--host` if you don't need to preview the website on another device on the same network (e.g., a smartphone or tablet).

### Build for Production

You can build this project with [Vite](https://vite.dev/) by running this command:

```sh
bun run build
```

This command will generate a `.svelte-kit` folder in the project root.

### Preview Production Build

If you want to preview your website before deploying it, run this command:

```sh
bun run preview
```

### Code Quality Checks

If you want to make sure your code is clean and that no line is unused or violates the linting rules, run these three commands:

```sh
bun run format
bun run lint
bun run check
```

There's no test runner configured in this repo — `bun run check` (types) and `bun run lint` are the correctness gates instead.

## Public API

This site also publishes a public, read-only REST API under `/api/v1` (blog posts, author profile, search, comments, and more) — no authentication required. Full reference, error codes, and examples: [`src/routes/api/v1/README.md`](src/routes/api/v1/README.md), also served live at [`GET /api/v1`](https://fkp.my.id/api/v1). Machine-readable OpenAPI spec: [`/.well-known/openapi.json`](https://fkp.my.id/.well-known/openapi.json) / [`/.well-known/openapi.yaml`](https://fkp.my.id/.well-known/openapi.yaml).

## Deployment

The site deploys to [Cloudflare Pages](https://pages.cloudflare.com/) via [`@sveltejs/adapter-cloudflare`](https://kit.svelte.dev/docs/adapter-cloudflare), building to `.svelte-kit/cloudflare`. Cloudflare Pages is connected directly to this repository — there's no separate manual deploy step or GitHub Actions deploy job, and both tiers below build with the same `bun run build` command (Cloudflare Pages doesn't support a per-environment build command). Two tiers are configured in the Cloudflare Pages dashboard, each with its own environment variable set:

- **Production** — pushes to `main` deploy to `fkp.my.id`. Needs the same environment variables as `.env.example` plus real `PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET` and `PUBLIC_SENTRY_ENVIRONMENT=production` (see `.env.production.example`).
- **Preview** — pushes to `develop` (and PRs) deploy to a `*.pages.dev` preview URL. Uses the same `.env.example` variables, but with Cloudflare's [dummy Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) instead of real ones and `PUBLIC_SENTRY_ENVIRONMENT=preview` (see `.env.preview.example`), so preview builds don't need a verified domain and don't pollute production error tracking.

Both tiers share the same Supabase project. Bindings (rate limiter, Workers AI) are declared in `wrangler.jsonc` and are shared across tiers too.

For local development against a given tier's config, copy the matching template on top of `.env` — e.g. `cp .env.preview.example .env.preview && bun run dev:preview` — Vite layers `.env` → `.env.[mode]` automatically. This is a local-only convenience; it has no effect on what Cloudflare Pages deploys.

## Containers

Three container artefacts are available for local preview, CI smoke-tests, or self-hosting:

| File | Toolchain | Notes |
| --- | --- | --- |
| [`Dockerfile`](Dockerfile) | Docker (multi-stage) | deps → builder → runner |
| [`Containerfile`](Containerfile) | Podman / OCI | Identical logic, fully-qualified `docker.io/` image names |
| [`docker.nix`](docker.nix) | Nix `dockerTools` | Reproducible, no Dockerfile required |

### Docker

```sh
# Build (SENTRY_AUTH_TOKEN is a BuildKit secret, not a --build-arg, so it
# never lands in the image's build history — omit --secret entirely if you
# don't need sourcemap upload, the build just skips it)
docker build \
  --build-arg PUBLIC_SUPABASE_URL=... \
  --build-arg PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg PUBLIC_SENTRY_DSN=... \
  --build-arg PUBLIC_CDN_BASE_URL=... \
  --build-arg PUBLIC_TURNSTILE_SITE_KEY=... \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  -t fkp-www .

# Run (pass remaining secrets at runtime, never bake into the image)
docker run --env-file .env -p 8788:8788 fkp-www
```

### Podman

```sh
podman build \
  --build-arg PUBLIC_SUPABASE_URL=... \
  --build-arg PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  -t fkp-www -f Containerfile .
podman run --env-file .env -p 8788:8788 fkp-www
```

### Nix (docker.nix)

```sh
# Build + load in one step (PUBLIC_* args are optional, default to "")
docker load < $(nix-build docker.nix \
  --argstr publicSupabaseUrl "..." \
  --argstr publicSupabasePublishableKey "..." \
  --argstr publicSentryDsn "..." \
  --argstr publicCdnBaseUrl "..." \
  --argstr publicTurnstileSiteKey "...")
docker run -p 8788:8788 fkp-www:latest

# Podman also works
podman load < result
```

`docker.nix` has no `SENTRY_AUTH_TOKEN`/secret-mount equivalent — Nix derivation build inputs persist in the store and daemon logs, so a real secret passed as a plain `--argstr` would leak the same way the old Dockerfile `ARG` did. Sourcemap upload is a Docker/Podman-only capability for that reason; the Nix image just skips it.

All three images start `wrangler pages dev` on port **8788** for local preview. `PUBLIC_*` vars are injected at build-time (Docker/Podman `ARG`, Nix `--argstr`); secrets like `SUPABASE_SERVICE_ROLE_KEY` must be passed via `--env-file` at `run` time — the app reads `platform.env.X ?? process.env.X` everywhere, so a plain `--env-file` at `run` time (without needing `.dev.vars`) works correctly. If you want the `AI` binding (`wrangler.jsonc`, `remote: true`, used for comment moderation) to hit the real Cloudflare API instead of silently falling back to the heuristic check, also include `CLOUDFLARE_API_TOKEN` in that `--env-file` — wrangler reads it directly for auth.

## Contributing

This repo uses [git-flow-next](https://git-flow.sh/) (classic preset: `main` for production, `develop` for integration, `feature/*`/`bugfix/*`/`release/*`/`hotfix/*` topic branches). See [`CLAUDE.md`](CLAUDE.md) for the full workflow, code style conventions, and architecture notes before opening a PR.

Found a security issue? Please don't open a public issue — see [`SECURITY.md`](SECURITY.md) for how to report it privately.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
