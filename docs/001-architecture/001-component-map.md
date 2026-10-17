# 1. Component Map

The four Workers, what they talk to, and which direction each call goes.

```mermaid
flowchart LR
    Browser(["Browser / API client"])

    subgraph CF["Cloudflare"]
        WEB["fkp-web<br/>fkp.my.id"]
        ADMIN["fkp-admin<br/>admin.fkp.my.id"]
        API["fkp-api<br/>api.fkp.my.id"]
        JOBS["fkp-jobs<br/>no route"]
        RL[["Rate Limiting<br/>API_RATE_LIMITER"]]
        AI[["Workers AI<br/>AI binding"]]
        Q[["Queue fkp-newsletter<br/>DLQ fkp-newsletter-dlq"]]
        R2[("R2 bucket<br/>via S3 API")]
        CDN[("CDN origin<br/>PUBLIC_CDN_BASE_URL")]
    end

    subgraph SB["Supabase"]
        PG[("Postgres + RLS<br/>via PostgREST")]
        AUTH["Auth<br/>password, TOTP, passkey"]
        ST[("Storage<br/>blog-posts bucket")]
        CRON["pg_cron<br/>prune jobs"]
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

    CRON --> PG

    WEB -.-> SEN
    ADMIN -.-> SEN
    API -.-> SEN
    JOBS -.-> SEN
```

## Notes

- **Workers** (`apps/*/wrangler.jsonc`):
    - `fkp-web` serves `fkp.my.id` and `www.fkp.my.id`, which is redirected to the apex.
    - `fkp-admin` serves `admin.fkp.my.id`.
    - `fkp-api` serves `api.fkp.my.id`.
    - `fkp-jobs` sets `workers_dev: false` and has no route. Its `fetch` handler returns 404.
- **R2 is not a Worker binding.** Every R2 read and write goes through the S3-compatible API (`@aws-sdk/client-s3`) using the `R2_*` secrets. No `r2_buckets` entry exists in any `wrangler.jsonc`.
- **`API_RATE_LIMITER` is the Workers Rate Limiting binding** (`ratelimits`, 60 requests per 60 s). It is namespace `1001` on web and `1002` on api. When the binding is missing, `packages/lib/src/server/rateLimit.ts` falls back to an in-memory window.
- **Queue:** admin publishes to `fkp-newsletter` through the `NEWSLETTER_QUEUE` producer. Jobs consumes it with batch size 10, 5 retries, and DLQ `fkp-newsletter-dlq`, and also consumes the DLQ to report each dead-lettered message to Sentry.
- **Cron:**
    - Jobs runs `17 3 * * *` (UTC) for asset cleanup.
    - Supabase `pg_cron` runs `prune-stale-subscriptions` (`17 3 * * *`), `prune-activity-log` (`31 3 * * *`) and `prune-login-failures` (`37 * * * *`).
- **Sentry** is reached through the SDKs: `@sentry/sveltekit` on web and admin, `@sentry/cloudflare` on api and jobs.

## Source

- `apps/web/wrangler.jsonc`, `apps/admin/wrangler.jsonc`, `apps/api/wrangler.jsonc`, `apps/jobs/wrangler.jsonc`
- `packages/lib/src/server/profileAssets.ts` (`assetStorage`), `rateLimit.ts`, `newsletterQueue.ts`
- `apps/jobs/src/index.ts`
- `cron.job` in the Supabase project
