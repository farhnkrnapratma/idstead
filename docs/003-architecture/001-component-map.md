# 1. Component Map

The four Workers, what they talk to, and which direction each call goes.

```mermaid
flowchart LR
    Browser(["Browser / API client"])

    subgraph CF["Cloudflare"]
        WEB["idstead-web<br/>example.com"]
        ADMIN["idstead-admin<br/>admin.example.com"]
        API["idstead-api<br/>api.example.com"]
        JOBS["idstead-jobs<br/>no route"]
        RL[["Rate Limiting<br/>API_RATE_LIMITER"]]
        AI[["Workers AI<br/>AI binding"]]
        Q[["Queue idstead-newsletter<br/>DLQ idstead-newsletter-dlq"]]
        R2[("R2 bucket idstead-assets<br/>ASSET_BUCKET binding")]
        CDN[("CDN origin<br/>PUBLIC_CDN_BASE_URL")]
    end

    subgraph SB["Supabase"]
        PG[("Postgres + RLS<br/>via PostgREST")]
        AUTH["Auth<br/>password, TOTP, passkey"]
        ST[("Storage<br/>blog-posts bucket")]
    end

    subgraph EXT["External"]
        TS["Turnstile"]
        RS["Resend"]
        GH["GitHub API"]
        SEN["Sentry"]
    end

    Browser --> WEB
    Browser --> ADMIN
    Browser --> API

    WEB -->|"anon + service-role"| PG
    WEB --> ST
    WEB -->|"identity, banners, content"| R2
    WEB -->|"/static /fonts /logo proxy"| CDN
    WEB --> RL
    WEB -->|"Llama Guard, ARD embeddings"| AI
    WEB -->|"siteverify"| TS
    WEB -->|"confirm, contact mail"| RS
    WEB -->|"projects"| GH

    ADMIN -->|"cookie session"| AUTH
    ADMIN -->|"service-role + user-scoped"| PG
    ADMIN --> ST
    ADMIN --> R2
    ADMIN -->|"password, profile"| RL
    ADMIN -->|"post summary, TL;DR"| AI
    ADMIN -->|"login"| TS
    ADMIN -->|"login alert, manual re-send"| RS
    ADMIN -->|"produce"| Q

    API -->|"anon only"| PG
    API --> ST
    API --> RL

    Q -->|"consume"| JOBS
    JOBS -->|"service-role"| PG
    JOBS -->|"newsletter batch"| RS
    JOBS -->|"daily cleanup"| R2
    JOBS -->|"daily cleanup"| ST

    WEB -.-> SEN
    ADMIN -.-> SEN
    API -.-> SEN
    JOBS -.-> SEN
```

## Notes

- **Workers** (`apps/*/wrangler.jsonc`):
    - `idstead-web` serves `example.com` and `www.example.com`, which is redirected to the apex.
    - `idstead-admin` serves `admin.example.com`.
    - `idstead-api` serves `api.example.com`.
    - `idstead-jobs` sets `workers_dev: false` and has no route. Its `fetch` handler returns 404.
- **R2 is a Worker binding.** web, admin and jobs declare `r2_buckets` binding `ASSET_BUCKET` → the `assetBucket` from `idstead.jsonc` (default `idstead-assets`) (`remote: true`, so local dev reaches the real bucket). `packages/lib/src/server/r2.ts` wraps it. The Workers no longer use `@aws-sdk/client-s3` or the `R2_*` secrets; only `scripts/migrate-cdn-layout.ts`, which runs with bun outside Workers, still uses the S3 API.
- **`API_RATE_LIMITER` is the Workers Rate Limiting binding** (`ratelimits`, 60 requests per 60 s). It is namespace `1001` on web, `1002` on api and `1003` on admin (password and profile writes). When the binding is missing, `packages/lib/src/server/rateLimit.ts` falls back to an in-memory window.
- **Queue:** admin publishes to `idstead-newsletter` through the `NEWSLETTER_QUEUE` producer. Jobs consumes it with batch size 10, 5 retries, and DLQ `idstead-newsletter-dlq`, and also consumes the DLQ to report each dead-lettered message to Sentry.
- **Cron:** jobs has two schedules from `idstead.jsonc` (UTC). `jobs.cron` (`17 3 * * *`) runs the asset cleanup, the post render refresh and the prunes of week-old pending subscriptions and month-old activity log rows; `jobs.hourlyCron` (`37 * * * *`, passed to the Worker as `HOURLY_CRON`) prunes login failures older than a day. The prunes go through `MaintenanceStore` (`@idstead/data`), which calls the `db_prune_*` functions. Nothing runs inside the database on a schedule.
- **Sentry** is reached through the SDKs: `@sentry/sveltekit` on web and admin, `@sentry/cloudflare` on api and jobs.

## Source

- `apps/web/wrangler.jsonc`, `apps/admin/wrangler.jsonc`, `apps/api/wrangler.jsonc`, `apps/jobs/wrangler.jsonc`
- `packages/lib/src/server/r2.ts`, `rateLimit.ts`, `newsletterQueue.ts`
- `apps/jobs/src/index.ts`
- `cron.job` in the Supabase project
