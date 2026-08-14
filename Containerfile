# syntax=docker/dockerfile:1
FROM docker.io/oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM docker.io/oven/bun:1-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG PUBLIC_SENTRY_DSN
ARG PUBLIC_CDN_BASE_URL
ARG PUBLIC_TURNSTILE_SITE_KEY

RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    bun run build

FROM docker.io/oven/bun:1-alpine AS runner

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/.svelte-kit/cloudflare ./.svelte-kit/cloudflare
COPY --from=builder /app/wrangler.jsonc ./wrangler.jsonc

USER appuser

EXPOSE 8788

ENV NODE_ENV=production

CMD ["bunx", "wrangler", "pages", "dev", ".svelte-kit/cloudflare", "--port", "8788"]
