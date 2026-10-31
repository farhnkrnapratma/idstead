// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { env } from 'cloudflare:workers';

const read = (name: string) =>
    (env as unknown as Record<string, unknown>)[name] as string | undefined;

export const PUBLIC_ADMIN_URL = read('PUBLIC_ADMIN_URL');
export const PUBLIC_API_BASE_URL = read('PUBLIC_API_BASE_URL');
export const PUBLIC_CDN_BASE_URL = read('PUBLIC_CDN_BASE_URL');
export const PUBLIC_SENTRY_DSN = read('PUBLIC_SENTRY_DSN');
export const PUBLIC_SENTRY_ENVIRONMENT = read('PUBLIC_SENTRY_ENVIRONMENT');
export const PUBLIC_SITE_URL = read('PUBLIC_SITE_URL');
export const PUBLIC_TURNSTILE_SITE_KEY = read('PUBLIC_TURNSTILE_SITE_KEY');
export const DATA_CACHE = read('DATA_CACHE');
export const GITHUB_PAT = read('GITHUB_PAT');
export const IP_SALT = read('IP_SALT');
export const OIDC_ENABLED = read('OIDC_ENABLED');
export const OIDC_SIGNING_KEY = read('OIDC_SIGNING_KEY');
export const RESEND_API_KEY = read('RESEND_API_KEY');
export const SUBSCRIBER_FROM_EMAIL = read('SUBSCRIBER_FROM_EMAIL');
export const TURNSTILE_SECRET = read('TURNSTILE_SECRET');
export const WRITES_FROZEN = read('WRITES_FROZEN');
