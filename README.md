<p align="center">
  <a href="https://fkp.my.id/">
    <img src="https://fkp.my.id/android-chrome-512x512.png" alt="Farhan Kurnia Pratama" width="200" height="200">
  </a>
</p>
<h1 align="center">Farhan Kurnia Pratama</h1>
<h3 align="center">AI Engineering | Cybersecurity | Software Engineering | Linux/Unix</h3>
<p align="center">Security-focused Software Engineer specializing in AI Engineering, Cybersecurity, and Linux/Unix systems, focused on building secure, reliable, maintainable, and privacy-conscious software.</p>
<p align="center">
  <a href="https://fkp.my.id/">Home</a>
  ·
  <a href="https://fkp.my.id/#projects">Projects</a>
  ·
  <a href="https://fkp.my.id/blog">Blog</a>
  ·
  <a href="https://fkp.my.id/#cv">CV</a>
  ·
  <a href="https://fkp.my.id/#funding">Funding</a>
  ·
  <a href="https://fkp.my.id/#contact">Contact</a>
</p>

---

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

### Install Dependencies

Before that, you need to clone or fork this repository (make sure you have [Git](https://git-scm.com/install/linux) installed). Simply run:

```
git clone <repository-url> www
cd <path_to_www>
```

Then install all dependencies before you start hacking by running this command:

```sh
bun install
```

### Configure Environment Variables

Variables live in [Phase](https://phase.dev) (app `www`, environments Development and Production). Run any command that needs them through `phase run`:

```sh
phase run --env dev bun run dev
phase run --env prod bun run build
```

Without Phase access, copy the single template and fill in real values:

```sh
cp .env.example .env
```

`.env.example` lists every variable once; Development and Production use the same keys with different values. Env files live at the repository root for every app, and Vite loads `.env` in every mode.

The dev server will not start correctly without a valid `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` at minimum.

> **Dev server won't start / crashes immediately?** This is almost always a missing or invalid `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`. Double-check those two values first before looking anywhere else.

And that's it, you're ready to start hacking!

### Repository Layout

This is a Bun workspaces monorepo. Each app is its own Cloudflare Worker, and all of them share `packages/lib`:

| Path | Deploys to | What it is |
| --- | --- | --- |
| `apps/web` | `fkp.my.id` | Public site (SvelteKit): homepage, blog, legal pages, feeds, discovery. |
| `apps/admin` | `admin.fkp.my.id` | Admin portal (SvelteKit). |
| `apps/api` | `api.fkp.my.id/v1` | Public read-only REST API (Hono). |
| `apps/jobs` | — (queue and cron only) | Newsletter delivery and daily storage cleanup. |
| `packages/lib` | — | Shared components, styles, markdown engine and server code. |

### Start Development Servers

`run.conf` defines shortcuts for the `run` command runner (installed separately): `run <name>` runs a block's default command and `run <name>.<key>` one of its other commands, from any directory in the repository. Several targets, or a group such as `dev`, run in parallel with labelled output and stop together on Ctrl+C:

```sh
run dev                           # web, admin, api and jobs
run dev.web dev.admin             # only web and admin
run dev.host                      # web, reachable from other devices
run -s PHASE_ENV=prod dev.admin   # admin with production values
run fmt.check                     # bun run fmt:check
run --list                        # every target
```

Or start one server directly:

```sh
bun run dev [--host]              # public site (Vite)
bun run dev:admin                 # admin portal on http://localhost:5174
bun run --filter @fkp/api dev     # API worker on http://localhost:8787
bun run --filter @fkp/jobs dev    # jobs worker on http://localhost:8788
```

The wrangler-based workers get their variables from `phase run --env dev`, or from the repository root by adding `--env-file ../../.env` to the `wrangler dev` command. Point the site at a local API by setting `PUBLIC_API_BASE_URL=http://localhost:8787`.

### Build

```sh
bun run build
```

This builds both SvelteKit apps into their `.svelte-kit/cloudflare` folders and bundles the API and jobs workers with `wrangler deploy --dry-run`.

### Code Quality Checks

If you want to make sure your code is clean, properly formatted, and passes all checks:

```sh
bun run fmt
bun run lint
bun run check
bun run test
```

## Public API

The public, read-only REST API lives at [`https://api.fkp.my.id/v1`](https://api.fkp.my.id/v1) (blog posts, author profile, CV, search, comments and more) — no authentication required. Full reference, error codes, and examples: [`apps/api/src/README.md`](apps/api/src/README.md), also served live at `GET /v1`. OpenAPI: [`/v1/openapi.json`](https://api.fkp.my.id/v1/openapi.json) / [`/v1/openapi.yaml`](https://api.fkp.my.id/v1/openapi.yaml).

`tests/apiV1.test.ts` checks every documented request shape against a running API worker. It is skipped unless `API_TEST_BASE_URL` is set, and sends about 50 requests, so leave a minute between runs to stay under the rate limit:

```sh
API_TEST_BASE_URL=http://localhost:8787 bun test tests/apiV1.test.ts
API_TEST_BASE_URL=https://api.fkp.my.id bun test tests/apiV1.test.ts
```

## Deployment

Every app deploys as a Cloudflare Worker through [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/); there is no GitHub Actions pipeline, so run `bun run check`, `bun run lint` and `bun run test` locally before pushing. Each Worker is connected to this repository with the root directory `/`, so Workers Builds installs the whole Bun workspace from the root lockfile, and its commands change into the app before building and deploying (`wrangler deploy` refuses to run from a workspace root):

| Worker | Build command | Deploy command | Build watch paths |
| --- | --- | --- | --- |
| `fkp-web` | `cd apps/web && bun run build` | `cd apps/web && bunx wrangler deploy` | `apps/web/*`, `packages/*`, `package.json`, `bun.lock`, `bunfig.toml` |
| `fkp-admin` | `cd apps/admin && bun run build` | `cd apps/admin && bunx wrangler deploy` | `apps/admin/*`, `packages/*`, `package.json`, `bun.lock`, `bunfig.toml` |
| `fkp-api` | `cd apps/api && bun run build` | `cd apps/api && bunx wrangler deploy` | `apps/api/*`, `packages/*`, `package.json`, `bun.lock`, `bunfig.toml` |
| `fkp-jobs` | `cd apps/jobs && bun run build` | `cd apps/jobs && bunx wrangler deploy` | `apps/jobs/*`, `packages/*`, `package.json`, `bun.lock`, `bunfig.toml` |

Environment variables are read at runtime, never baked in at build time, so they live as Worker secrets rather than build variables. Phase is the source of truth and syncs them to each Worker (see [docs/004-development/002-environment.md](docs/004-development/002-environment.md)).

- **Production** — pushes to `main` deploy to the custom domains declared in each `wrangler.jsonc`. The Worker secrets come from the Phase Production sync, including real Turnstile keys and `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Preview** — not connected yet: the triggers only watch `main`, so pushes to `develop` deploy nothing. To add previews, add a non-production branch trigger per Worker and give previews their own variables: Cloudflare's [dummy Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) and `PUBLIC_SENTRY_ENVIRONMENT=preview`.

One-time Cloudflare and Supabase setup:

1. Create the queues `fkp-newsletter` and `fkp-newsletter-dlq` (`bunx wrangler queues create <name>`).
2. Remove `fkp.my.id` and `www.fkp.my.id` from the old Pages project before the first `fkp-web` deploy, so the Worker can claim the custom domains.
3. In Supabase Auth, add `https://admin.fkp.my.id` to the redirect URLs, and add it to the Passkeys **Relying Party Origins** so passkeys keep working on the admin host.
4. Apply the pending database migrations in `supabase/migrations/` before deploying code that depends on them (`db_posts.public_id` in particular).

All apps share the same Supabase project. Local `.env*` files are for development only and have no effect on what Cloudflare deploys.

## Markdown syntax

Posts and legal pages are written in **MDRS** (Markdown Rich Syntax, `.mdrs`), a superset of CommonMark and GitHub Flavored Markdown rendered by `packages/lib/src/markdown.ts`. On top of standard Markdown it adds directives (`:::note`, `:::callout`, `:::details`, `:::tabs`, `:::snippets`, `:::steps`, `:::embed`, `:::references`), code block options (`filename=`, `mark=`), extended task states, math (`$$ … $$`, `:::math`), Mermaid and chart fences, and document variables (`:::define`, `${…}`) with live site data.

```mdrs
:::tip
Directives open with `:::name` and close with a bare `:::`.
:::
```

The full reference, with examples for every feature, is in [`docs/002-mdrs/`](docs/002-mdrs/README.md).

## Contributing

This repo uses [git-flow-next](https://git-flow.sh/) (classic preset: `main` for production, `develop` for integration, `feature/*`/`bugfix/*`/`release/*`/`hotfix/*` topic branches). See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branches, commits and checks, [`docs/`](docs/README.md) for architecture, API, setup and operations documentation, and [`CLAUDE.md`](CLAUDE.md) for code style conventions before opening a PR.

Found a security issue? Please don't open a public issue — see [`SECURITY.md`](SECURITY.md) for how to report it privately.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
