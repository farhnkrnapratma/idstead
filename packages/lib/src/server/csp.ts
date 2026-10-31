// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AnalyticsSources } from './analytics';

interface CspEnv {
    sentryDsn?: string;
    cdnBaseUrl?: string;
    apiBaseUrl?: string;
    analytics?: AnalyticsSources;
    dev?: boolean;
}

const SCRIPT_SOURCES = ['https://challenges.cloudflare.com', 'https://api.dashboard.instatus.com'];

const IMAGE_SOURCES = [
    'https://github.com',
    'https://avatars.githubusercontent.com',
    'https://opengraph.githubassets.com',
    'https://repository-images.githubusercontent.com'
];

const FRAME_SOURCES = [
    'https://challenges.cloudflare.com',
    'https://www.youtube.com',
    'https://codepen.io'
];

const CONNECT_SOURCES = [
    'https://api.instatus.com',
    'https://*.instatus.com',
    'https://api.dashboard.instatus.com',
    'https://challenges.cloudflare.com'
];

function originOf(value: string | undefined): string {
    if (!value) return '';
    try {
        const { origin } = new URL(value.trim());
        return origin === 'null' ? '' : origin;
    } catch {
        return '';
    }
}

export function buildContentSecurityPolicy(env: CspEnv = {}): string {
    const sentry = originOf(env.sentryDsn);
    const cdn = originOf(env.cdnBaseUrl);
    const api = originOf(env.apiBaseUrl);

    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
            "'self'",
            "'unsafe-inline'",
            ...SCRIPT_SOURCES,
            ...(env.analytics?.script ?? [])
        ],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'img-src': [
            "'self'",
            'data:',
            'blob:',
            cdn,
            ...IMAGE_SOURCES,
            ...(env.analytics?.img ?? [])
        ],
        'media-src': ["'self'", cdn],
        'frame-src': FRAME_SOURCES,
        'connect-src': [
            "'self'",
            sentry,
            cdn,
            api,
            ...CONNECT_SOURCES,
            ...(env.analytics?.connect ?? []),
            ...(env.dev ? ['ws://localhost:*', 'http://localhost:*'] : [])
        ],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"]
    };

    return Object.entries(directives)
        .map(([name, sources]) => `${name} ${[...new Set(sources.filter(Boolean))].join(' ')}`)
        .join('; ');
}
