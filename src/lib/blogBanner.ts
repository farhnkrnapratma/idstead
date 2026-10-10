export const BANNER_WIDTH = 1280;
export const BANNER_HEIGHT = 640;
export const BANNER_LIMIT = 500 * 1024;
export const BANNER_SOURCE_LIMIT = 10_000_000;
export const BANNER_PIXEL_LIMIT = 40_000_000;
export const BANNER_QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4] as const;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BannerChange = { operation: 'keep' | 'remove' } | { operation: 'replace'; file: Blob };

export function blogBannerAlt(title: string, excerpt?: string | null) {
    const description = excerpt?.trim();
    return `Banner image for the blog post “${title.trim()}”${description ? ` — ${description}` : ''}`;
}

export function bannerKey(postId: string, version: string) {
    if (!UUID_PATTERN.test(postId) || !UUID_PATTERN.test(version))
        throw new Error('Invalid banner identity.');
    return `blog/banners/${postId}/${version}.webp`;
}

export function bannerUrl(post: { id: string; banner_version?: string | null }) {
    return post.banner_version ? `/${bannerKey(post.id, post.banner_version)}` : null;
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
