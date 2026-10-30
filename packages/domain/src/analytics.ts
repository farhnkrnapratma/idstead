export const ANALYTICS_PROVIDERS = [
    'none',
    'ga4',
    'gtm',
    'umami',
    'plausible',
    'cloudflare'
] as const;

export type AnalyticsProvider = (typeof ANALYTICS_PROVIDERS)[number];

export type AnalyticsSettings =
    | { provider: 'none' }
    | { provider: 'ga4'; measurementId: string }
    | { provider: 'gtm'; containerId: string }
    | { provider: 'umami'; websiteId: string; scriptUrl: string }
    | { provider: 'plausible'; scriptUrl: string }
    | { provider: 'cloudflare'; token: string };

export interface AnalyticsFacts {
    enabled: boolean;
    provider: AnalyticsProvider;
    name: string;
    cookies: boolean;
}

export const ANALYTICS_PROVIDER_INFO: Record<
    AnalyticsProvider,
    { name: string; cookies: boolean }
> = {
    none: { name: 'None', cookies: false },
    ga4: { name: 'Google Analytics 4', cookies: true },
    gtm: { name: 'Google Tag Manager', cookies: true },
    umami: { name: 'Umami', cookies: false },
    plausible: { name: 'Plausible', cookies: false },
    cloudflare: { name: 'Cloudflare Web Analytics', cookies: false }
};

export const ANALYTICS_DEFAULT_SCRIPTS = {
    umami: 'https://cloud.umami.is/script.js',
    plausible: 'https://plausible.io/js/script.js'
} as const;

export const ANALYTICS_OFF: AnalyticsSettings = { provider: 'none' };

const GA4_ID = /^G-[A-Z0-9]{4,12}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLOUDFLARE_TOKEN = /^[0-9a-f]{32}$/;
const MAX_URL_LENGTH = 300;

export class AnalyticsSettingsError extends Error {
    readonly field: string;

    constructor(field: string, message: string) {
        super(message);
        this.field = field;
    }
}

function field(input: Record<string, unknown>, name: string): string {
    const value = input[name];
    return typeof value === 'string' ? value.trim() : '';
}

function matching(input: Record<string, unknown>, name: string, pattern: RegExp, message: string) {
    const value = field(input, name);
    if (!pattern.test(value)) throw new AnalyticsSettingsError(name, message);
    return value;
}

function scriptUrl(input: Record<string, unknown>, fallback: string): string {
    const raw = field(input, 'scriptUrl') || fallback;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new AnalyticsSettingsError('scriptUrl', 'Enter a full https:// URL.');
    }
    if (
        url.protocol !== 'https:'
        || url.username
        || url.password
        || url.hash
        || !url.pathname.endsWith('.js')
        || url.href.length > MAX_URL_LENGTH
    )
        throw new AnalyticsSettingsError(
            'scriptUrl',
            'Use an https:// URL to a .js file, without credentials or a fragment.'
        );
    return url.href;
}

export function parseAnalyticsSettings(input: unknown): AnalyticsSettings {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new AnalyticsSettingsError('provider', 'Choose an analytics provider.');
    const record = input as Record<string, unknown>;
    switch (record.provider) {
        case 'none':
            return ANALYTICS_OFF;
        case 'ga4':
            return {
                provider: 'ga4',
                measurementId: matching(
                    record,
                    'measurementId',
                    GA4_ID,
                    'Use an ID like G-ABC123XYZ.'
                )
            };
        case 'gtm':
            return {
                provider: 'gtm',
                containerId: matching(record, 'containerId', GTM_ID, 'Use an ID like GTM-ABC1234.')
            };
        case 'umami':
            return {
                provider: 'umami',
                websiteId: matching(
                    record,
                    'websiteId',
                    UUID,
                    'Use the website ID from Umami, a lowercase UUID.'
                ),
                scriptUrl: scriptUrl(record, ANALYTICS_DEFAULT_SCRIPTS.umami)
            };
        case 'plausible':
            return {
                provider: 'plausible',
                scriptUrl: scriptUrl(record, ANALYTICS_DEFAULT_SCRIPTS.plausible)
            };
        case 'cloudflare':
            return {
                provider: 'cloudflare',
                token: matching(
                    record,
                    'token',
                    CLOUDFLARE_TOKEN,
                    'Use the 32-character token from Cloudflare Web Analytics.'
                )
            };
        default:
            throw new AnalyticsSettingsError('provider', 'Choose an analytics provider.');
    }
}

export function storedAnalyticsSettings(value: unknown): AnalyticsSettings {
    try {
        return parseAnalyticsSettings(value);
    } catch {
        return ANALYTICS_OFF;
    }
}

export function analyticsFacts(settings: AnalyticsSettings): AnalyticsFacts {
    const info = ANALYTICS_PROVIDER_INFO[settings.provider];
    return {
        enabled: settings.provider !== 'none',
        provider: settings.provider,
        name: info.name,
        cookies: info.cookies
    };
}
