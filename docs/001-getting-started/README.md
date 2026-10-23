# Getting Started

There are three ways to set up a new Idstead site, and they all perform the same steps:

| Page | Covers |
| --- | --- |
| [001-setup-script.md](001-setup-script.md) | `bun run setup`: a dry run, then `apply` |
| [002-ai-agent.md](002-ai-agent.md) | An AI coding agent driving the script through the `setup-idstead` skill |
| [003-manual-setup.md](003-manual-setup.md) | The same steps by hand |

## What you need

- [Bun](https://bun.com/) and a clone of this repository with `bun install` run.
- A Cloudflare account with your domain on it, and Wrangler signed in (`bunx wrangler login`, or `CLOUDFLARE_API_TOKEN` in the environment).
- A Supabase project for admin sign-in (Supabase Auth only; the site's data lives in Cloudflare D1, which the setup script creates).
- A Turnstile widget, a Resend account with a verified sending domain, and a Sentry project. The API and jobs Workers refuse to deploy without their Sentry DSN, Resend key and sender address.

## Environment variables

The setup script reads every value from the process environment. Bun loads a `.env` file in the repository root automatically, and a secret manager works too (`phase run --env prod -- bun run setup`). `.env.example` lists every key. The script needs these:

| Variables | Notes |
| --- | --- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | From the Supabase project's API settings, for admin sign-in. The service role key stays server-side. |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | The Turnstile widget for the contact form, comments and admin sign-in. |
| `IP_SALT` | A long random string, for example from `openssl rand -hex 32`. Keep it stable: it salts the hashed IP addresses the site stores. |
| `RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL` | Newsletter and contact form email. |
| `PUBLIC_SENTRY_DSN` | Error reporting. `PUBLIC_SENTRY_ENVIRONMENT` defaults to `production`. |
| `PUBLIC_CDN_BASE_URL` | The public origin that serves the asset bucket's files, such as an R2 custom domain. The site proxies static files and images from it. |
| `PUBLIC_SITE_URL`, `PUBLIC_API_BASE_URL` | Optional: they default to `https://<site domain>` and `https://<api domain>` from `idstead.jsonc`. |

Optional values are passed on when they are set: `GITHUB_PAT` (projects from GitHub), `PUBLIC_GA_MEASUREMENT_ID`, and `PUBLIC_STATUS_PAGE_HOST` with `PUBLIC_STATUS_PAGE_CODE`.

## After setup

These steps happen in other dashboards, so the setup script cannot do them:

- **Supabase Auth > URL Configuration:** add `https://admin.<domain>` to the redirect URLs, and to the passkey relying party origins if you use passkeys.
- **Supabase Auth > Attack Protection:** enable CAPTCHA with Turnstile, using the same secret as `TURNSTILE_SECRET`. The admin sign-in sends a Turnstile token.
- **Turnstile:** allow the site and admin hostnames on the widget.
- **Resend:** verify the domain of `SUBSCRIBER_FROM_EMAIL`.
- **Admin portal:** sign in at `https://admin.<domain>/login`, change the temporary password, and enrol an authenticator app or a passkey under Account settings. Until you do, the account has no second factor.
- **Content:** fill in your profile, review the legal pages (their [README](../../templates/legal/README.md) lists what to check), and publish your first post.
- **Continuous deployment (optional):** connect each Worker to your repository in Workers Builds, as described in [Deployment](../006-operations/001-deployment.md).
