# Manual Setup

The steps of the [setup script](001-setup-script.md), without the script. The environment variables are listed in [Getting Started](README.md#environment-variables).

1. Copy `idstead.example.jsonc` to `idstead.jsonc`, set `domains.site`, and run `bun run configure`.
2. Create the bucket and queues: `bunx wrangler r2 bucket create <assetBucket>`, `bunx wrangler queues create <newsletterQueue>` and `bunx wrangler queues create <newsletterQueue>-dlq`.
3. Create the database with `bunx wrangler d1 create <database name>`, put its ID in `cloudflare.database.id` in `idstead.jsonc`, run `bun run configure`, then apply the schema from `apps/web` with `bunx wrangler d1 migrations apply <database name> --remote`.
4. In Cloudflare Zero Trust, add a self-hosted Access application for the admin host (`domains.admin`) with an Allow policy for your email, then copy the team domain (`<team>.cloudflareaccess.com`) and the application's audience tag into `access.teamDomain` and `access.aud` in `idstead.jsonc` and run `bun run configure`.
5. Run `bun run build`, then in each of `apps/api`, `apps/jobs`, `apps/web` and `apps/admin` run `bunx wrangler deploy --secrets-file <file>`, where the file is a JSON object of that Worker's secrets (see step 8 of the [setup script](001-setup-script.md)).
6. Sign in to the admin portal and add the legal pages from `templates/legal/` in the legal page editor.

Then finish the steps under [After setup](README.md#after-setup).
