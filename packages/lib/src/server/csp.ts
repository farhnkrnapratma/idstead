interface CspEnv {
    supabaseUrl?: string;
    sentryDsn?: string;
    cdnBaseUrl?: string;
    apiBaseUrl?: string;
    dev?: boolean;
}

const SCRIPT_SOURCES = [
    'https://challenges.cloudflare.com',
    'https://www.googletagmanager.com',
    'https://api.dashboard.instatus.com',
    'https://static.cloudflareinsights.com'
];

const IMAGE_SOURCES = [
    'https://github.com',
    'https://avatars.githubusercontent.com',
    'https://opengraph.githubassets.com',
    'https://repository-images.githubusercontent.com',
    'https://www.googletagmanager.com',
    'https://www.google.co.id',
    'https://*.google-analytics.com',
    'https://*.g.doubleclick.net'
];

const FRAME_SOURCES = [
    'https://challenges.cloudflare.com',
    'https://www.googletagmanager.com',
    'https://www.youtube.com',
    'https://codepen.io'
];

const CONNECT_SOURCES = [
    'https://api.instatus.com',
    'https://fkp.instatus.com',
    'https://api.dashboard.instatus.com',
    'https://challenges.cloudflare.com',
    'https://www.googletagmanager.com',
    'https://www.google.com',
    'https://analytics.google.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.g.doubleclick.net'
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

function websocketOf(origin: string): string {
    return origin.startsWith('https://') ? `wss://${origin.slice(8)}` : '';
}

export function buildContentSecurityPolicy(env: CspEnv = {}): string {
    const supabase = originOf(env.supabaseUrl);
    const sentry = originOf(env.sentryDsn);
    const cdn = originOf(env.cdnBaseUrl);
    const api = originOf(env.apiBaseUrl);

    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", ...SCRIPT_SOURCES],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', cdn, ...IMAGE_SOURCES],
        'media-src': ["'self'", cdn],
        'frame-src': FRAME_SOURCES,
        'connect-src': [
            "'self'",
            supabase,
            websocketOf(supabase),
            sentry,
            cdn,
            api,
            ...CONNECT_SOURCES,
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
