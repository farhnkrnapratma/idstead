---
paths:
    - idstead*.jsonc
    - apps/*/wrangler*.jsonc
    - apps/*/vite.config.ts
    - apps/*/src/appEnv.ts
    - apps/web/src/env.ts
    - .env.example
    - package.json
    - tooling/**
    - docs/001-getting-started/**
    - docs/002-configuration/**
    - docs/006-operations/**
---

# Tooling, configuration and environments

Run tests, `bun run check`, and `bun run lint` after non-trivial changes (repository changes must keep the suites in `tests/contracts/` passing; every adapter runs them). `lint` includes `lint:deprecated`, so the codebase uses no deprecated APIs, icons or options; `overrides` in the root `package.json` keeps transitive dependencies off releases npm marks deprecated or `bun audit` flags (drop an entry once the parent package ships the fix), and the root `tsconfig.json` type-checks `tests/`, `tooling/` and the root config files; there is no CI pipeline, so these local runs are the only gate before Workers Builds deploys. `tests/` stays at the repository root and imports from `packages/lib/src` and `apps/*/src`. Build plugins, Git hooks and `tooling/lib-usage.ts` (which app reaches each lib file) live in `tooling/`; The one-off migration scripts were removed after the move to D1 (they are in git history); the admin **Export all data** zip is the archive. `tooling/setup.ts` (pure parts in `tooling/setup/plan.ts`) is the setup script described in [Getting started](../../docs/001-getting-started/README.md); the `setup-idstead` skill (`.claude/skills/setup-idstead/`) drives it for Claude Code.

Where the instance runs (domains, Worker, bucket and queue names, rate limiter namespaces, cron) lives in `idstead.jsonc`; edit it and run `bun run configure` instead of editing `apps/*/wrangler.jsonc`, which is generated from `apps/*/wrangler.template.jsonc` ([Instance configuration](../../docs/002-configuration/001-instance.md)). Env files stay at the repository root (`apps/*/vite.config.ts` set `envDir` and SvelteKit's `env.dir` to `../..`). Values come from a root `.env` or a secret manager that starts the process (this instance uses Phase, see [This instance](../../CLAUDE.md#this-instance)); `.env.example` lists every key once. Vars: `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_URL` (both required: `apiBaseUrl()` and `configuredSiteUrl()` throw when they are missing; the site URL is used when the profile has none, for newsletter links, resume verification-bundle links and the admin's generated website banner), `PUBLIC_STATUS_PAGE_HOST`/`PUBLIC_STATUS_PAGE_CODE` (optional Instatus page for the footer badge; the badge is hidden without them), `PUBLIC_GA_MEASUREMENT_ID` (optional Google Analytics 4 property; no analytics script loads without it), `SENTRY_ORG`/`SENTRY_PROJECT` (build-time source-map upload), Sentry, Turnstile, Resend (`RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL` — newsletter and contact form), `IP_SALT`, `ADMIN_EMAILS` (required on the admin: the emails accepted in the Access token), `CLOUDFLARE_ACCOUNT_ID` (setup creates the admin's Access application in it), `CLOUDFLARE_API_TOKEN` (setup's Access calls and wrangler auth, needed for the `AI` binding's `remote: true` mode in local dev). The wrangler workers (`api`, `jobs`) declare their secrets in `secrets.required` in `wrangler.jsonc`, so `wrangler dev` reads them from the environment locally and deploys fail if one is missing on the Worker; add a name there when a worker starts reading a new one. In production every Worker reads Worker secrets ([Environment variables](../../docs/002-configuration/002-environment.md#worker-secrets)); `bun run setup` uploads each Worker's keys with its deploy.

## Environments

Each app is a Worker; the [setup script](../../docs/001-getting-started/001-setup-script.md) deploys them once, and Workers Builds can redeploy them from the repository with the root directory `/` and commands that `cd apps/<app>` first ([Deployment](../../docs/006-operations/001-deployment.md) lists the commands and watch paths):

- **Production** — `main` branch, `wrangler deploy` to the custom domains in each `wrangler.jsonc`. Real Turnstile keys, `PUBLIC_SENTRY_ENVIRONMENT=production`.
- **Build triggers** watch only what each Worker bundles, with build caching on: `api` and `jobs` watch their app plus `packages/{lib,data,domain,mdrs/core}`, `web` adds `packages/{ui,mdrs/dom}`, `admin` watches all of `packages/*`, and all four watch `package.json`, `bun.lock` and `bunfig.toml`. When a Worker starts importing another package, add it to that Worker's watch paths in Workers Builds, or changes to it will not redeploy the Worker.
- **Preview** — previews need their own variables: Cloudflare's [dummy Turnstile keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), `PUBLIC_SENTRY_ENVIRONMENT=preview`. `*.workers.dev` hosts are treated as preview (noindex, robots disallow).

All apps of an instance share one D1 database, one R2 bucket, and one Cloudflare Access application guards the admin (`access` in `idstead.jsonc`, rendered into the admin Worker as `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`). Sentry events are tagged with `PUBLIC_SENTRY_ENVIRONMENT`, falling back to `import.meta.env.MODE` locally.
