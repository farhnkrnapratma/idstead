---
paths:
    - apps/jobs/**
    - packages/lib/src/server/renderQueue.ts
    - packages/lib/src/server/postRender.ts
    - packages/lib/src/server/newsletterQueue.ts
---

# Jobs (`apps/jobs`)

Consumes the newsletter queue (`newsletterQueue` in `idstead.jsonc`, default `idstead-newsletter`; retries, dead-letter queue `<queue>-dlq`, which it also consumes to report each dead-lettered message to Sentry) and runs two crons from `idstead.jsonc`: `jobs.cron` (daily: `cleanupBlogAssets`/`cleanupAssets`, the render refresh and the pending-subscription and activity log prunes) and `jobs.hourlyCron` (the login failure prune; the Worker tells the runs apart by its `HOURLY_CRON` var). The prunes go through `MaintenanceStore`; nothing is scheduled inside the database. While `WRITES_FROZEN` is on it retries queue messages and skips cron runs. The same queue carries `{ kind: 'refresh-renders' }` messages (`packages/lib/src/server/renderQueue.ts`), which admin sends after saving a published post or unpublishing one; the consumer and the daily cron both run `refreshPostRenders()` (`packages/lib/src/server/postRender.ts`) re-renders published posts whose stored render is `live`, missing or from another `RENDER_VERSION`, checking the 20 newest posts and rendering at most 5 per run to stay inside the free plan's 50 external subrequests per invocation. `wrangler.jsonc` aliases `$app/env/private`/`$app/env/public` to `src/appEnv.ts`, which reads `cloudflare:workers` env, so shared server code runs unchanged.
