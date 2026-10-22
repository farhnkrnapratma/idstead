import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
    PUBLIC_API_BASE_URL: { public: true, schema: optional },
    PUBLIC_CDN_BASE_URL: { public: true, schema: optional },
    PUBLIC_SENTRY_DSN: { public: true, schema: optional },
    PUBLIC_SENTRY_ENVIRONMENT: { public: true, schema: optional },
    PUBLIC_SITE_URL: { public: true, schema: optional },
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, schema: optional },
    PUBLIC_SUPABASE_URL: { public: true, schema: optional },
    PUBLIC_TURNSTILE_SITE_KEY: { public: true, schema: optional },
    DATA_BACKEND: { schema: optional },
    GITHUB_PAT: { schema: optional },
    IP_SALT: { schema: optional },
    RESEND_API_KEY: { schema: optional },
    SUBSCRIBER_FROM_EMAIL: { schema: optional },
    SUPABASE_SERVICE_ROLE_KEY: { schema: optional },
    TURNSTILE_SECRET: { schema: optional },
    WRITES_FROZEN: { schema: optional }
});
