import { env } from 'cloudflare:workers';

const read = (name: string) =>
    (env as unknown as Record<string, unknown>)[name] as string | undefined;

export const PUBLIC_SUPABASE_URL = read('PUBLIC_SUPABASE_URL');
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY = read('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const PUBLIC_CDN_BASE_URL = read('PUBLIC_CDN_BASE_URL');
export const PUBLIC_SENTRY_DSN = read('PUBLIC_SENTRY_DSN');
export const PUBLIC_SENTRY_ENVIRONMENT = read('PUBLIC_SENTRY_ENVIRONMENT');
export const SUPABASE_SERVICE_ROLE_KEY = read('SUPABASE_SERVICE_ROLE_KEY');
export const RESEND_API_KEY = read('RESEND_API_KEY');
export const SUBSCRIBER_FROM_EMAIL = read('SUBSCRIBER_FROM_EMAIL');
export const R2_ACCOUNT_ID = read('R2_ACCOUNT_ID');
export const R2_BUCKET_NAME = read('R2_BUCKET_NAME');
export const R2_ACCESS_KEY_ID = read('R2_ACCESS_KEY_ID');
export const R2_SECRET_ACCESS_KEY = read('R2_SECRET_ACCESS_KEY');
