import {
    ANALYTICS_OFF,
    ANALYTICS_PROVIDER_INFO,
    type AnalyticsSettings
} from '@idstead/domain/analytics.ts';
import type { SiteSettingsRepository } from '@idstead/data';

export interface AnalyticsSources {
    script: string[];
    connect: string[];
    img: string[];
}

export interface SiteAnalytics {
    settings: AnalyticsSettings;
    consent: boolean;
}

export const CONSENT_STORAGE_KEY = 'idstead_cookie_consent_v2';

const GOOGLE_SOURCES: AnalyticsSources = {
    script: ['https://www.googletagmanager.com'],
    connect: [
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://*.g.doubleclick.net',
        'https://www.google.com'
    ],
    img: [
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
        'https://*.g.doubleclick.net',
        'https://www.google.com'
    ]
};

const NO_SOURCES: AnalyticsSources = { script: [], connect: [], img: [] };

const HOSTED_COLLECTORS: Record<string, string[]> = {
    'https://cloud.umami.is': ['https://gateway.umami.is']
};

function escapeAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function origin(url: string): string {
    return new URL(url).origin;
}

const CONSENT_DEFAULTS = `window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
const consent = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
let saved = null;
try { saved = JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}') || 'null'); } catch (e) {}
if (saved) for (const key of Object.keys(consent)) consent[key] = saved[key] === 'granted' ? 'granted' : 'denied';
else consent.wait_for_update = 500;
gtag('consent', 'default', consent);`;

export function analyticsHead(settings: AnalyticsSettings, siteHost: string): string {
    switch (settings.provider) {
        case 'none':
            return '';
        case 'ga4':
            return `<script>
${CONSENT_DEFAULTS}
gtag('js', new Date());
gtag('config', '${settings.measurementId}');
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.measurementId}"></script>`;
        case 'gtm':
            return `<script>
${CONSENT_DEFAULTS}
window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
</script>
<script async src="https://www.googletagmanager.com/gtm.js?id=${settings.containerId}"></script>`;
        case 'umami':
            return `<script defer src="${escapeAttr(settings.scriptUrl)}" data-website-id="${settings.websiteId}"></script>`;
        case 'plausible':
            return `<script defer data-domain="${escapeAttr(siteHost)}" src="${escapeAttr(settings.scriptUrl)}"></script>`;
        case 'cloudflare':
            return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${settings.token}"}'></script>`;
    }
}

export function analyticsSources(settings: AnalyticsSettings): AnalyticsSources {
    switch (settings.provider) {
        case 'none':
            return NO_SOURCES;
        case 'ga4':
        case 'gtm':
            return GOOGLE_SOURCES;
        case 'umami':
        case 'plausible': {
            const host = origin(settings.scriptUrl);
            return { script: [host], connect: [host, ...(HOSTED_COLLECTORS[host] ?? [])], img: [] };
        }
        case 'cloudflare':
            return {
                script: ['https://static.cloudflareinsights.com'],
                connect: ['https://cloudflareinsights.com'],
                img: []
            };
    }
}

export async function siteAnalytics(repos: {
    site: Pick<SiteSettingsRepository, 'analytics'>;
}): Promise<SiteAnalytics> {
    const settings = await repos.site.analytics().catch(() => ANALYTICS_OFF);
    return { settings, consent: ANALYTICS_PROVIDER_INFO[settings.provider].cookies };
}
