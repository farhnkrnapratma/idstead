import * as publicEnv from '$app/env/public';

export function configuredSiteUrl(platform: unknown): string {
    const url =
        (platform as { env?: { PUBLIC_SITE_URL?: string } } | undefined)?.env?.PUBLIC_SITE_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_SITE_URL;
    if (!url?.trim()) throw new Error('PUBLIC_SITE_URL is not configured.');
    return url.trim().replace(/\/+$/, '');
}
