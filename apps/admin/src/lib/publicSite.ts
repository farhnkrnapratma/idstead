// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as publicEnv from '$app/env/public';

export function publicSiteUrl(
    pageData: unknown,
    fallback: string | undefined = publicEnv.PUBLIC_SITE_URL
): string {
    return (
        (pageData as { author?: { siteUrl?: string } } | null)?.author?.siteUrl
        || fallback
        || ''
    ).replace(/\/+$/, '');
}

export function publicHref(siteUrl: string, href: string): string {
    return href.startsWith('/') && !href.startsWith('//') ? `${siteUrl}${href}` : href;
}
