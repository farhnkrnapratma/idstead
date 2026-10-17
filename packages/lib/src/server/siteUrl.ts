import * as publicEnv from '$app/env/public';

export const DEFAULT_SITE_URL = 'https://fkp.my.id';

export function configuredSiteUrl(platform: unknown): string {
    return (
        (platform as { env?: { PUBLIC_SITE_URL?: string } } | undefined)?.env?.PUBLIC_SITE_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_SITE_URL
        || DEFAULT_SITE_URL
    ).replace(/\/+$/, '');
}
