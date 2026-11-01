// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ImageSource } from '@idstead/ui/types.ts';
import { bannerUrl, type PostAssetOwner } from '@idstead/domain/blogAssets.ts';

export type { ImageSource };
export const BANNER_WIDTH = 1280;
export const BANNER_HEIGHT = 640;

export const SITE_BANNER_WIDTH = 1280;
export const SITE_BANNER_HEIGHT = 640;
export const SITE_BANNER_OG_WIDTH = 1200;
export const SITE_BANNER_OG_HEIGHT = 630;
export const BANNER_LIMIT = 500 * 1024;
export const BANNER_SOURCE_LIMIT = 10_000_000;
export const BANNER_PIXEL_LIMIT = 40_000_000;
export const BANNER_QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4] as const;

export type BannerChange =
    { operation: 'keep' | 'remove' } | { operation: 'replace'; webp: Blob; avif: Blob };

export function blogBannerAlt(title: string, excerpt?: string | null) {
    const description = excerpt?.trim();
    return `Banner image for the blog post “${title.trim()}”${description ? ` — ${description}` : ''}`;
}

export {
    UUID_PATTERN,
    bannerKey,
    type PostAssetOwner,
    stagingAssetHome,
    postAssetHome,
    bannerObjectKey,
    bannerUrl,
    bannerUrl as publicBannerUrl
} from '@idstead/domain/blogAssets.ts';

export function avifSources(webpUrl?: string | null): ImageSource[] {
    if (!webpUrl || !/\.webp(?:\?|$)/.test(webpUrl)) return [];
    return [{ srcset: webpUrl.replace(/\.webp(\?|$)/, '.avif$1'), type: 'image/avif' }];
}

export function bannerSources(
    post: PostAssetOwner & { banner_version?: string | null },
    cdnBase: string
): ImageSource[] {
    return avifSources(bannerUrl(post, cdnBase));
}

export function bannerCrop(width: number, height: number, allowUpscale = false) {
    if (
        !Number.isSafeInteger(width)
        || !Number.isSafeInteger(height)
        || width < 1
        || height < 1
        || width * height > BANNER_PIXEL_LIMIT
    )
        throw new Error('Choose an image no larger than 40 megapixels.');
    if (!allowUpscale && (width < BANNER_WIDTH || height < BANNER_HEIGHT))
        throw new Error('Choose an image at least 1280 × 640 pixels after orientation.');
    const cropWidth = Math.min(width, height * 2);
    const cropHeight = cropWidth / 2;
    return {
        x: (width - cropWidth) / 2,
        y: (height - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
    };
}

export async function sha256(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte =>
        byte.toString(16).padStart(2, '0')
    ).join('');
}
