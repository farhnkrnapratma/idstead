# Setup Script

`tooling/setup.ts` (`bun run setup`) sets up an instance from the environment variables listed in [Getting Started](README.md#environment-variables).

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

`domain` replaces `idstead.jsonc` with the product defaults for that domain. To change Worker, bucket or queue names too, add an `instance` object shaped like [`idstead.jsonc`](../002-configuration/001-instance.md). Without `domain` or `instance` the script uses the existing `idstead.jsonc`.

The script runs these steps in order and stops at the first one that fails. Each step checks the current state first, so running it again only does what is still missing:

1. **Instance configuration.** Writes `idstead.jsonc` from the answers and renders `apps/*/wrangler.jsonc` from it, like `bun run configure`.
2. **Environment variables.** Stops with the list of missing variables.
3. **Cloudflare account.** Checks that Wrangler is signed in.
4. **R2 bucket and queues.** Creates the asset bucket, the newsletter queue and its `-dlq` dead-letter queue when they do not exist.
5. **D1 database.** Creates the D1 database named in `idstead.jsonc` when it does not exist, writes its ID to `idstead.jsonc`, renders the Wrangler configs again so every Worker binds it as `DB`, and applies the migrations in `packages/data/d1/migrations/`.
6. **Admin sign-in (Cloudflare Access).** Reads the Zero Trust team domain, creates a reusable Access policy that admits only `adminEmail` and a self-hosted Access application for the admin host, then writes `access.teamDomain` and `access.aud` to `idstead.jsonc` and renders the Wrangler configs again. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; an existing application for the admin host is reused. It also sets `ADMIN_EMAILS` for the admin Worker.
7. **Legal pages.** Adds `/privacy`, `/terms`, `/security` and `/ai-disclosure` from [`templates/legal/`](../../templates/legal/README.md) when D1 has no page with content for them. Existing pages are left alone.
8. **Build and deploy.** Builds every app and deploys the API, jobs, web and admin Workers, uploading each Worker's secrets with the deploy (`wrangler deploy --secrets-file`). The secrets file lives in a private temporary folder and is deleted afterwards. Each Worker gets only the keys it reads: `secrets.required` in the API and jobs templates, and `apps/web/src/env.ts` and `apps/admin/src/env.ts` for the two sites. The custom domains in `idstead.jsonc` are attached on deploy.
9. **Next steps.** Prints what is left to do by hand, listed under [After setup](README.md#after-setup).
