import {
    CONTENT_LICENSE_DEFAULT,
    type ContentLicenseSettings
} from '@idstead/domain/contentLicense.ts';
import type { SiteSettingsRepository } from '@idstead/data';
import { workerBinding } from './workerEnv';

export function siteContentLicense(repos: {
    site: Pick<SiteSettingsRepository, 'contentLicense'>;
}): Promise<ContentLicenseSettings> {
    return repos.site.contentLicense().catch(() => CONTENT_LICENSE_DEFAULT);
}

export async function sourceCodeUrl(): Promise<string | null> {
    const value = await workerBinding<string>('SOURCE_URL');
    if (!value || !URL.canParse(value)) return null;
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
}
