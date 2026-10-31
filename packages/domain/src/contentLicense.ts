export const CONTENT_LICENSES = [
    'all-rights-reserved',
    'CC0-1.0',
    'CC-BY-4.0',
    'CC-BY-SA-4.0',
    'CC-BY-NC-4.0',
    'CC-BY-NC-SA-4.0',
    'CC-BY-ND-4.0',
    'CC-BY-NC-ND-4.0'
] as const;

export type ContentLicenseId = (typeof CONTENT_LICENSES)[number];

export interface ContentLicenseInfo {
    label: string;
    name: string;
    url: string | null;
}

export const CONTENT_LICENSE_INFO: Record<ContentLicenseId, ContentLicenseInfo> = {
    'all-rights-reserved': { label: 'All rights reserved', name: 'All rights reserved', url: null },
    'CC0-1.0': {
        label: 'CC0 1.0',
        name: 'CC0 1.0 Universal',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/'
    },
    'CC-BY-4.0': {
        label: 'CC BY 4.0',
        name: 'Creative Commons Attribution 4.0 International',
        url: 'https://creativecommons.org/licenses/by/4.0/'
    },
    'CC-BY-SA-4.0': {
        label: 'CC BY-SA 4.0',
        name: 'Creative Commons Attribution-ShareAlike 4.0 International',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/'
    },
    'CC-BY-NC-4.0': {
        label: 'CC BY-NC 4.0',
        name: 'Creative Commons Attribution-NonCommercial 4.0 International',
        url: 'https://creativecommons.org/licenses/by-nc/4.0/'
    },
    'CC-BY-NC-SA-4.0': {
        label: 'CC BY-NC-SA 4.0',
        name: 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International',
        url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
    },
    'CC-BY-ND-4.0': {
        label: 'CC BY-ND 4.0',
        name: 'Creative Commons Attribution-NoDerivatives 4.0 International',
        url: 'https://creativecommons.org/licenses/by-nd/4.0/'
    },
    'CC-BY-NC-ND-4.0': {
        label: 'CC BY-NC-ND 4.0',
        name: 'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International',
        url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
    }
};

export interface ContentLicenseSettings {
    license: ContentLicenseId;
}

export const CONTENT_LICENSE_DEFAULT: ContentLicenseSettings = { license: 'all-rights-reserved' };

export class ContentLicenseSettingsError extends Error {
    readonly field: string;

    constructor(field: string, message: string) {
        super(message);
        this.field = field;
    }
}

export function isContentLicenseId(value: unknown): value is ContentLicenseId {
    return typeof value === 'string' && (CONTENT_LICENSES as readonly string[]).includes(value);
}

export function parseContentLicenseSettings(input: unknown): ContentLicenseSettings {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new ContentLicenseSettingsError('license', 'Choose a content license.');
    const { license } = input as Record<string, unknown>;
    if (!isContentLicenseId(license))
        throw new ContentLicenseSettingsError('license', 'Choose a content license.');
    return { license };
}

export function storedContentLicenseSettings(value: unknown): ContentLicenseSettings {
    try {
        return parseContentLicenseSettings(value);
    } catch {
        return CONTENT_LICENSE_DEFAULT;
    }
}

export interface ResolvedContentLicense extends ContentLicenseInfo {
    id: ContentLicenseId;
}

export function contentLicense(id: ContentLicenseId): ResolvedContentLicense {
    return { id, ...CONTENT_LICENSE_INFO[id] };
}

export function resolvePostLicense(
    postLicense: ContentLicenseId | null,
    site: ContentLicenseSettings
): ResolvedContentLicense {
    return contentLicense(postLicense ?? site.license);
}

export type BannerOrigin = 'own' | 'third-party' | 'ai-generated';

export type BannerCredit =
    | { origin: 'third-party'; author: string; url: string | null; license: string | null }
    | { origin: 'ai-generated'; tool: string | null };

export const BANNER_CREDIT_LIMITS = { author: 80, url: 300, license: 60, tool: 60 } as const;

function creditText(value: unknown, max: number, field: string): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.includes('\0'))
        throw new ContentLicenseSettingsError(field, 'Enter plain text.');
    const trimmed = value.trim();
    if (trimmed.length > max)
        throw new ContentLicenseSettingsError(field, `Use at most ${max} characters.`);
    return trimmed || null;
}

function creditUrl(value: unknown): string | null {
    const text = creditText(value, BANNER_CREDIT_LIMITS.url, 'bannerCreditUrl');
    if (text === null) return null;
    const url = URL.canParse(text) ? new URL(text) : null;
    if (!url || url.protocol !== 'https:' || url.username || url.password)
        throw new ContentLicenseSettingsError('bannerCreditUrl', 'Enter a full https:// URL.');
    return url.href;
}

export function parseBannerCredit(input: unknown): BannerCredit | null {
    if (input === undefined || input === null) return null;
    if (typeof input !== 'object' || Array.isArray(input))
        throw new ContentLicenseSettingsError(
            'bannerOrigin',
            'Choose where the banner comes from.'
        );
    const record = input as Record<string, unknown>;
    switch (record.origin) {
        case 'own':
            return null;
        case 'third-party': {
            const author = creditText(
                record.author,
                BANNER_CREDIT_LIMITS.author,
                'bannerCreditAuthor'
            );
            if (!author)
                throw new ContentLicenseSettingsError(
                    'bannerCreditAuthor',
                    'Name the creator of the banner.'
                );
            return {
                origin: 'third-party',
                author,
                url: creditUrl(record.url),
                license: creditText(
                    record.license,
                    BANNER_CREDIT_LIMITS.license,
                    'bannerCreditLicense'
                )
            };
        }
        case 'ai-generated':
            return {
                origin: 'ai-generated',
                tool: creditText(record.tool, BANNER_CREDIT_LIMITS.tool, 'bannerCreditTool')
            };
        default:
            throw new ContentLicenseSettingsError(
                'bannerOrigin',
                'Choose where the banner comes from.'
            );
    }
}

export function storedBannerCredit(value: unknown): BannerCredit | null {
    try {
        return parseBannerCredit(typeof value === 'string' ? JSON.parse(value) : value);
    } catch {
        return null;
    }
}

export function storedPostLicense(value: unknown): ContentLicenseId | null {
    return isContentLicenseId(value) ? value : null;
}

export function licenseNotice(license: ResolvedContentLicense): string {
    return license.url ? `Licensed under ${license.label}: ${license.url}` : 'All rights reserved.';
}

export function bannerCreditNotice(credit: BannerCredit | null): string | null {
    if (!credit) return null;
    if (credit.origin === 'ai-generated')
        return `Banner: AI-generated image${credit.tool ? ` (${credit.tool})` : ''}; no license claimed.`;
    const source = credit.url ? ` (${credit.url})` : '';
    return `Banner: ${credit.author}${source}${credit.license ? `, ${credit.license}` : ''}.`;
}
