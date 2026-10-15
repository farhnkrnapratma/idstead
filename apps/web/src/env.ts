import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
    PUBLIC_API_BASE_URL: { public: true, schema: optional },
    PUBLIC_CDN_BASE_URL: { public: true, schema: optional },
    PUBLIC_SENTRY_DSN: { public: true, schema: optional },
    PUBLIC_SENTRY_ENVIRONMENT: { public: true, schema: optional },
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, schema: optional },
    PUBLIC_SUPABASE_URL: { public: true, schema: optional },
    PUBLIC_TURNSTILE_SITE_KEY: { public: true, schema: optional },
    GITHUB_PAT: { schema: optional },
    IP_SALT: { schema: optional },
    R2_ACCESS_KEY_ID: { schema: optional },
    R2_ACCOUNT_ID: { schema: optional },
    R2_BUCKET_NAME: { schema: optional },
    R2_SECRET_ACCESS_KEY: { schema: optional },
    RESEND_API_KEY: { schema: optional },
    SUBSCRIBER_FROM_EMAIL: { schema: optional },
    SUPABASE_SERVICE_ROLE_KEY: { schema: optional },
    TURNSTILE_SECRET: { schema: optional }
});
