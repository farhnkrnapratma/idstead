import { env } from 'cloudflare:workers';

const read = (name: string) =>
    (env as unknown as Record<string, unknown>)[name] as string | undefined;

export const PUBLIC_CDN_BASE_URL = read('PUBLIC_CDN_BASE_URL');
export const PUBLIC_SENTRY_DSN = read('PUBLIC_SENTRY_DSN');
export const PUBLIC_SENTRY_ENVIRONMENT = read('PUBLIC_SENTRY_ENVIRONMENT');
export const PUBLIC_SITE_URL = read('PUBLIC_SITE_URL');
export const IP_SALT = read('IP_SALT');
export const RESEND_API_KEY = read('RESEND_API_KEY');
export const SUBSCRIBER_FROM_EMAIL = read('SUBSCRIBER_FROM_EMAIL');
export const WRITES_FROZEN = read('WRITES_FROZEN');
export const DATA_CACHE = read('DATA_CACHE');
