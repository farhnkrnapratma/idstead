<h1 align="center">Idstead</h1>
<p align="center">A self-hostable personal site and identity home: profile, blog, projects, resume, funding and contact pages, an admin portal and a public API, running on Cloudflare Workers.</p>
<p align="center"><a href="https://fkp.my.id/">Live example</a></p>

---

> **Warning:** Idstead is being extracted from a personal site and is not ready for other deployments yet. Data lives in Cloudflare D1 and R2; admin sign-in still uses Supabase Auth until a later release. Expect breaking changes until the first release.

## What you get

- **A public site**: a homepage summarising your profile, experience, latest posts and projects, plus `/blog`, `/projects`, `/resume`, `/funding` and `/contact`, and privacy, terms, security and AI disclosure pages.
- **A blog** written in [MDRS](docs/008-mdrs/README.md), a Markdown superset with callouts, tabs, steps, math, diagrams, charts and live site data, with search, tags, comments screened by an AI moderation model, "was this helpful" feedback and an email newsletter.
- **Machine-readable twins**: every post and legal page also exists as `.md` and `.txt`, next to an Atom feed, a sitemap, `llms.txt` and `.well-known` discovery documents.
- **A public read-only REST API** (`/v1`) for posts, comments, the author profile, resume and search, with an OpenAPI description.
- **An admin portal** on its own host, behind MFA or a passkey: a post editor with live preview, comment moderation, profile, resume and legal page management, and activity analytics.
- **A downloadable resume** with checksums and a detached OpenPGP signature.
- **An identity home**: WebFinger, your avatar by email hash the way apps use Gravatar, and "Sign in with Idstead", an OpenID Connect provider for the apps you register ([Identity provider](docs/003-architecture/012-identity-provider.md)).
- **Visitor controls**: light and dark themes, font scale, reduced motion, higher contrast, a dyslexia-friendly font and keyboard-first navigation.

All personal content (name, bio, resume, skills, links, posts) lives in the database. The code holds none of it, so one codebase serves any number of sites.

## Requirements

- [Bun](https://bun.com/), the only package manager and runtime used here.
- A Cloudflare account with a domain, for Workers, R2, Queues, Workers AI and rate limiting.
- A [Supabase](https://supabase.com/) project for admin sign-in (Supabase Auth only).
- Optional: [Resend](https://resend.com/) for the newsletter and contact form, [Turnstile](https://developers.cloudflare.com/turnstile/) keys, [Sentry](https://sentry.io/) and Google Analytics.

## Getting started

```sh
git clone <repository-url> idstead
cd idstead
bun install
```

1. **Describe your instance.** Copy `idstead.example.jsonc` to `idstead.jsonc`, set your domain and, if you like, the Worker, bucket and queue names, then run `bun run configure` to render each app's `wrangler.jsonc`. See [instance configuration](docs/002-configuration/001-instance.md).
2. **Set environment variables.** `.env.example` lists every one; copy it to `.env` and fill it in. `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL` are required. See [environment](docs/002-configuration/002-environment.md).
3. **Create the local database:** `bun run db:local` applies the D1 migrations to a local database the dev servers share. For production, `bun run setup` creates the D1 database and applies them.
4. **Run it locally:**

    ```sh
    bun run dev                          # public site
    bun run dev:admin                    # admin portal, http://localhost:5174
    bun run --filter @idstead/api dev    # API worker, http://localhost:8787
    bun run --filter @idstead/jobs dev   # jobs worker, http://localhost:8788
    ```

5. **Add your content** in the admin portal. Starter texts for the legal pages are in [`templates/legal/`](templates/legal/README.md).
6. **Deploy** each app as a Worker; see [deployment](docs/006-operations/001-deployment.md).

`bun run setup` does steps 1, 5 and 6 for you, along with the Cloudflare resources and the admin account, and an AI coding agent can drive it through the `setup-idstead` skill. See [setting up an instance](docs/001-getting-started/README.md).

## Repository layout

| Path | Deploys as | What it is |
| --- | --- | --- |
| `apps/web` | the site's apex domain | Public site (SvelteKit): pages, blog, legal pages, feeds and discovery. |
| `apps/admin` | `admin.` subdomain | Admin portal (SvelteKit). |
| `apps/api` | `api.` subdomain, `/v1` | Public read-only REST API (Hono). |
| `apps/jobs` | queue consumer and cron | Newsletter delivery, post render refreshes and storage cleanup. |
| `packages/lib` |  | Site feature components, server helpers and API handlers. |
| `packages/ui` |  | The design system (`@idstead/ui`): tokens, styles, UI primitives and stores. |
| `packages/domain` |  | Pure helpers and types (`@idstead/domain`), including the instance configuration schema. |
| `packages/data` |  | The server-only data layer (`@idstead/data`): repository ports and their adapters. |
| `packages/mdrs/core` |  | The MDRS engine (`@mdrs/core`). |
| `packages/mdrs/dom` |  | The browser side of MDRS (`@mdrs/dom`) and `mdrs.css`. |
| `packages/mdrs/editor` |  | The Markdown editor (`@mdrs/editor`). |
| `templates/` |  | Starter content for a new site. |
| `tooling/`, `scripts/` |  | Build tooling, Git hooks and one-off migration commands. |

## Development

```sh
bun run test     # regression and contract tests
bun run check    # instance config, svelte-check and tsc
bun run lint     # prettier, eslint and the deprecated-API check
bun run build    # every app
```

There is no CI pipeline, so these local runs are the gate before a deploy. Architecture, API, operations and security documentation is in [`docs/`](docs/README.md).

## Public API

Each site serves a read-only REST API at `https://api.<your domain>/v1`, with no authentication. The reference, with every parameter and error code, is [`apps/api/src/README.md`](apps/api/src/README.md), and the API also serves it at `GET /v1`, next to `/v1/openapi.json` and `/v1/openapi.yaml`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branches, commits and checks. To report a vulnerability, follow [`SECURITY.md`](SECURITY.md) rather than opening a public issue.

## License

MIT. See [LICENSE](LICENSE).
