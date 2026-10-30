# Instance configuration

An Idstead instance describes where it runs in `idstead.jsonc` at the repository root. `bun run configure` renders each `apps/*/wrangler.jsonc` from `apps/*/wrangler.template.jsonc` and that file. The rendered files are committed, so Workers Builds deploys them as they are. `bun run check` runs `bun run configure --check` first and fails when a rendered file no longer matches `idstead.jsonc` or its template.

Personal content (name, bio, resume, links, legal pages) never goes in this file. It lives in the database and is edited in the admin.

## Fields

Only `domains.site` is required. Every other field has a default. `idstead.example.jsonc` lists all of them.

| Field | Default | Used for |
| --- | --- | --- |
| `domains.site` | (required) | Public site route of the web Worker |
| `domains.admin` | `admin.<site>` | Admin Worker route |
| `domains.api` | `api.<site>` | API Worker route |
| `domains.redirectWww` | `true` | Adds the `www.<site>` route; the web Worker redirects it to the apex |
| `cloudflare.workers.web`, `.admin`, `.api`, `.jobs` | `idstead-web`, `idstead-admin`, `idstead-api`, `idstead-jobs` | Worker names |
| `cloudflare.assetBucket` | `idstead-assets` | R2 bucket bound as `ASSET_BUCKET` |
| `cloudflare.newsletterQueue` | `idstead-newsletter` | Newsletter queue. The dead-letter queue is the same name plus `-dlq`, and the jobs Worker recognizes it by that suffix |
| `cloudflare.database.name` | `idstead` | D1 database bound as `DB` |
| `cloudflare.database.id` | none | The D1 database ID. Every Worker gets the `DB` binding, with migrations from `packages/data/d1/migrations`, only once this is set, so an instance without a D1 database still deploys. |
| `cloudflare.rateLimitNamespaces.web`, `.api`, `.admin` | `1001`, `1002`, `1003` | `API_RATE_LIMITER` namespace IDs |
| `jobs.cron` | `17 3 * * *` | Daily cleanup, render refresh and the pending-subscription and activity log prunes |
| `jobs.hourlyCron` | `37 * * * *` | Hourly prune of expired lockout counters (failed OpenID Connect client secrets). Must differ from `jobs.cron`: the jobs Worker tells the two runs apart by schedule (`HOURLY_CRON`). |
| `access.teamDomain`, `access.aud` | none | Cloudflare Access application that guards the admin host: the Zero Trust team domain (`<team>.cloudflareaccess.com`) and the application's audience tag. Rendered into the admin Worker as `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. `bun run setup` fills them; without them a deployed admin refuses every request. |

Names must be lowercase letters, digits and hyphens. `packages/domain/src/instance.ts` validates the file and fills the defaults.

## Changing the configuration

1. Edit `idstead.jsonc`.
2. Run `bun run configure`.
3. Commit `idstead.jsonc` together with the rendered `apps/*/wrangler.jsonc`.

To change something every instance shares, such as a compatibility date or a binding, edit the template in `apps/*/wrangler.template.jsonc` and run `bun run configure`. Placeholders are whole JSON strings such as `"{{workers.web}}"` or `"{{routes.web}}"`, and `tooling/configure.ts` lists every name it fills.

## Environment variables

Values that are not part of the Worker topology stay in environment variables. `.env.example` lists them. These ones are instance-specific:

- `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL` are required.
- `PUBLIC_STATUS_PAGE_HOST` and `PUBLIC_STATUS_PAGE_CODE` are optional. They name an Instatus page for the footer badge, which is hidden without them.
- `PUBLIC_GA_MEASUREMENT_ID` is optional. It names the Google Analytics 4 property (`G-...`) that `gtag.js` reports to under consent mode; without it the page loads no analytics script.
- `SENTRY_ORG` and `SENTRY_PROJECT` name the Sentry project that build-time source maps are uploaded to, together with `SENTRY_AUTH_TOKEN`.
