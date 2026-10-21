# Setting Up an Instance

There are three ways to set up a new Idstead site, and they all perform the same steps: run the setup script yourself, ask an AI coding agent to run it, or follow the manual steps below. The script is `tooling/setup.ts` (`bun run setup`).

> **Warning:** A new Supabase project cannot be set up from this repository yet. The migrations in `supabase/migrations/` start from a schema that already existed when they were written, so they cannot build an empty database. The setup script stops at its database check when the schema is missing. A schema that builds from scratch arrives with the move to Cloudflare D1.

## What you need

- [Bun](https://bun.com/) and a clone of this repository with `bun install` run.
- A Cloudflare account with your domain on it, and Wrangler signed in (`bunx wrangler login`, or `CLOUDFLARE_API_TOKEN` in the environment).
- A Supabase project with the Idstead schema (see the warning above).
- A Turnstile widget, a Resend account with a verified sending domain, and a Sentry project. The API and jobs Workers refuse to deploy without their Sentry DSN, Resend key and sender address.

## Environment variables

The script reads every value from the process environment. Bun loads a `.env` file in the repository root automatically, and a secret manager works too (`phase run --env prod -- bun run setup`). `.env.example` lists every key. The script needs these:

| Variables | Notes |
| --- | --- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | From the Supabase project's API settings. The service role key stays server-side. |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | The Turnstile widget for the contact form, comments and admin sign-in. |
| `IP_SALT` | A long random string, for example from `openssl rand -hex 32`. Keep it stable: it salts the hashed IP addresses the site stores. |
| `RESEND_API_KEY`, `SUBSCRIBER_FROM_EMAIL` | Newsletter and contact form email. |
| `PUBLIC_SENTRY_DSN` | Error reporting. `PUBLIC_SENTRY_ENVIRONMENT` defaults to `production`. |
| `PUBLIC_CDN_BASE_URL` | The public origin that serves the asset bucket's files, such as an R2 custom domain. The site proxies static files and images from it. |
| `PUBLIC_SITE_URL`, `PUBLIC_API_BASE_URL` | Optional: they default to `https://<site domain>` and `https://<api domain>` from `idstead.jsonc`. |

Optional values are passed on when they are set: `GITHUB_PAT` (projects from GitHub), `PUBLIC_GA_MEASUREMENT_ID`, and `PUBLIC_STATUS_PAGE_HOST` with `PUBLIC_STATUS_PAGE_CODE`.

## Option 1: the setup script

```sh
bun run setup                        # dry run: checks everything and lists what it would change
bun run setup apply                  # makes the changes
bun run setup apply --skip-deploy    # everything except the build and deploy
```

Without an answers file the script asks for the site domain (when there is no `idstead.jsonc`) and the admin email address. To run it without questions, pass both in a JSON file:

```json
{ "domain": "example.com", "adminEmail": "you@example.com" }
```

```sh
bun run setup apply --answers=answers.json
```

`domain` replaces `idstead.jsonc` with the product defaults for that domain. To change Worker, bucket or queue names too, add an `instance` object shaped like [`idstead.jsonc`](../004-development/005-instance-configuration.md). Without `domain` or `instance` the script uses the existing `idstead.jsonc`.

The script runs these steps in order and stops at the first one that fails. Each step checks the current state first, so running it again only does what is still missing:

1. **Instance configuration.** Writes `idstead.jsonc` from the answers and renders `apps/*/wrangler.jsonc` from it, like `bun run configure`.
2. **Environment variables.** Stops with the list of missing variables.
3. **Cloudflare account.** Checks that Wrangler is signed in.
4. **R2 bucket and queues.** Creates the asset bucket, the newsletter queue and its `-dlq` dead-letter queue when they do not exist.
5. **Database.** Checks that the Supabase project has the Idstead schema.
6. **Admin account.** Creates a confirmed Supabase user with the `admin` role and prints a temporary password once. An existing user with that email is given the `admin` role instead.
7. **Legal pages.** Adds `/privacy`, `/terms` and `/security` from [`templates/legal/`](../../templates/legal/README.md) when the database has no page for them. Existing pages are left alone.
8. **Build and deploy.** Builds every app and deploys the API, jobs, web and admin Workers, uploading each Worker's secrets with the deploy (`wrangler deploy --secrets-file`). The secrets file lives in a private temporary folder and is deleted afterwards. Each Worker gets only the keys it reads: `secrets.required` in the API and jobs templates, and `apps/web/src/env.ts` and `apps/admin/src/env.ts` for the two sites. The custom domains in `idstead.jsonc` are attached on deploy.
9. **Next steps.** Prints what is left to do by hand, listed under [After the script](#after-the-script).

## Option 2: an AI coding agent

Ask the agent to "set up Idstead with the setup-idstead skill". The skill is in `.agents/skills/setup-idstead/SKILL.md`, with a link in `.claude/skills/` for Claude Code. It tells the agent to:

- collect the domain and admin email from you,
- write the answers file,
- run the dry run, and fix what it reports with you,
- run `apply` only after you confirm,
- and hand the temporary password and the next steps back to you.

The agent never writes your secrets into files or chat. It asks you to put them in `.env` or your secret manager yourself.

## Option 3: by hand

The same steps, without the script:

1. Copy `idstead.example.jsonc` to `idstead.jsonc`, set `domains.site`, and run `bun run configure`.
2. Create the bucket and queues: `bunx wrangler r2 bucket create <assetBucket>`, `bunx wrangler queues create <newsletterQueue>` and `bunx wrangler queues create <newsletterQueue>-dlq`.
3. In Supabase Auth, create a user for yourself with a confirmed email, then set its app metadata to `{"role": "admin"}` (Authentication > Users, or the admin API).
4. Run `bun run build`, then in each of `apps/api`, `apps/jobs`, `apps/web` and `apps/admin` run `bunx wrangler deploy --secrets-file <file>`, where the file is a JSON object of that Worker's secrets (see Option 1, step 8).
5. Sign in to the admin portal and add the legal pages from `templates/legal/` in the legal page editor.

## After the script

These steps happen in other dashboards and the script cannot do them:

- **Supabase Auth > URL Configuration:** add `https://admin.<domain>` to the redirect URLs, and to the passkey relying party origins if you use passkeys.
- **Supabase Auth > Attack Protection:** enable CAPTCHA with Turnstile, using the same secret as `TURNSTILE_SECRET`. The admin sign-in sends a Turnstile token.
- **Turnstile:** allow the site and admin hostnames on the widget.
- **Resend:** verify the domain of `SUBSCRIBER_FROM_EMAIL`.
- **Admin portal:** sign in at `https://admin.<domain>/login`, change the temporary password, and enrol an authenticator app or a passkey under Account settings. Until you do, the account has no second factor.
- **Content:** fill in your profile, review the legal pages (their [README](../../templates/legal/README.md) lists what to check), and publish your first post.
- **Continuous deployment (optional):** connect each Worker to your repository in Workers Builds, as described in [Deployment](001-deployment.md).
