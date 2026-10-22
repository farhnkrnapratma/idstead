import { env } from 'cloudflare:workers';

const read = (name: string) =>
    (env as unknown as Record<string, unknown>)[name] as string | undefined;

export const PUBLIC_SUPABASE_URL = read('PUBLIC_SUPABASE_URL');
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY = read('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const PUBLIC_CDN_BASE_URL = read('PUBLIC_CDN_BASE_URL');
export const PUBLIC_SENTRY_DSN = read('PUBLIC_SENTRY_DSN');
export const PUBLIC_SENTRY_ENVIRONMENT = read('PUBLIC_SENTRY_ENVIRONMENT');
export const PUBLIC_SITE_URL = read('PUBLIC_SITE_URL');
export const IP_SALT = read('IP_SALT');
export const SUPABASE_SERVICE_ROLE_KEY = read('SUPABASE_SERVICE_ROLE_KEY');
export const RESEND_API_KEY = read('RESEND_API_KEY');
export const SUBSCRIBER_FROM_EMAIL = read('SUBSCRIBER_FROM_EMAIL');
export const DATA_BACKEND = read('DATA_BACKEND');
export const WRITES_FROZEN = read('WRITES_FROZEN');
