import { env } from 'cloudflare:workers';

const read = (name: string) =>
    (env as unknown as Record<string, unknown>)[name] as string | undefined;

export const PUBLIC_CDN_BASE_URL = read('PUBLIC_CDN_BASE_URL');
export const PUBLIC_SENTRY_DSN = read('PUBLIC_SENTRY_DSN');
export const PUBLIC_SENTRY_ENVIRONMENT = read('PUBLIC_SENTRY_ENVIRONMENT');
export const DATA_CACHE = read('DATA_CACHE');
