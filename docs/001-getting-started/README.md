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
- Cloudflare Zero Trust on the same account (the Free plan is enough). Its Access protects the admin portal; open Zero Trust once and pick a team name before running setup.
- A Turnstile widget, a Resend account with a verified sending domain, and a Sentry project. The API and jobs Workers refuse to deploy without their Sentry DSN, Resend key and sender address.

## Environment variables

The setup script reads every value from the process environment. Bun loads a `.env` file in the repository root automatically, and a secret manager works too (`phase run --env prod -- bun run setup`). `.env.example` lists every key. The script needs these:

| Variables | Notes |
| --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | For the Access application in front of the admin: permissions `Access: Apps and Policies Write` and `Access: Organizations, Identity Providers, and Groups Read`. Without them, create the application by hand (see [Manual setup](003-manual-setup.md)). |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | The Turnstile widget for the contact form, comments and subscriptions. |
| `IP_SALT` | A long random string, for example from `openssl rand -hex 32`. Keep it stable: it salts the hashed IP addresses the site stores. |
| `RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL` | Newsletter and contact form email. |
| `PUBLIC_SENTRY_DSN` | Error reporting. `PUBLIC_SENTRY_ENVIRONMENT` defaults to `production`. |
| `PUBLIC_CDN_BASE_URL` | The public origin that serves the asset bucket's files, such as an R2 custom domain. The site proxies static files and images from it. |
| `PUBLIC_SITE_URL`, `PUBLIC_API_BASE_URL` | Optional: they default to `https://<site domain>` and `https://<api domain>` from `idstead.jsonc`. |

Optional values are passed on when they are set: `GITHUB_PAT` (projects: the public repositories of the token's owner), `PUBLIC_GA_MEASUREMENT_ID`, and `PUBLIC_STATUS_PAGE_HOST` with `PUBLIC_STATUS_PAGE_CODE`.

## After setup

These steps happen in other dashboards, so the setup script cannot do them:

- **Two-factor authentication:** in Cloudflare Zero Trust, require two-factor authentication (passkey, security key or authenticator app) for the admin application, or turn it on for the Cloudflare account you sign in with.
- **Turnstile:** allow the site hostname on the widget.
- **Resend:** verify the domain of `SUBSCRIBER_FROM_EMAIL`.
- **Admin portal:** open `https://admin.<domain>` and sign in through Cloudflare Access with the admin email.
- **Content:** fill in your profile, review the legal pages (their [README](../../templates/legal/README.md) lists what to check), and publish your first post.
- **Continuous deployment (optional):** connect each Worker to your repository in Workers Builds, as described in [Deployment](../006-operations/001-deployment.md).
