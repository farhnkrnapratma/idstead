// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as publicEnv from '$app/env/public';

export function configuredSiteUrl(platform: unknown): string {
    const url =
        (platform as { env?: { PUBLIC_SITE_URL?: string } } | undefined)?.env?.PUBLIC_SITE_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_SITE_URL;
    if (!url?.trim()) throw new Error('PUBLIC_SITE_URL is not configured.');
    return url.trim().replace(/\/+$/, '');
}

export function configuredAdminUrl(platform: unknown): string {
    const url =
        (platform as { env?: { PUBLIC_ADMIN_URL?: string } } | undefined)?.env?.PUBLIC_ADMIN_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_ADMIN_URL;
    if (url?.trim()) return url.trim().replace(/\/+$/, '');
    const site = new URL(configuredSiteUrl(platform));
    return `${site.protocol}//admin.${site.host}`;
}
