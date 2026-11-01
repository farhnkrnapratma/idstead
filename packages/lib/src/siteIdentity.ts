// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const IMAGE_LIMIT = 500_000;
export const UPLOAD_LIMIT = 10_000_000;
export function identityAssetUrl(name: string, version?: string | null) {
    return version ? `/${name}?v=${encodeURIComponent(version)}` : '';
}

export function avatarSource(profile?: { avatar?: string; avatarVersion?: string | null } | null) {
    return identityAssetUrl('avatar.png', profile?.avatarVersion) || profile?.avatar || '';
}

export function publicAvatarUrl(
    profile?: { avatar?: string; avatarVersion?: string | null; siteUrl?: string } | null
) {
    const source = avatarSource(profile);
    if (!source || !profile?.siteUrl) return '';
    return new URL(source, profile.siteUrl).href;
}

export function avatarWebpSource(profile?: { avatarVersion?: string | null } | null) {
    return identityAssetUrl('avatar.webp', profile?.avatarVersion);
}

export function avatarSources(profile?: { avatarVersion?: string | null } | null) {
    if (!profile?.avatarVersion) return [];
    return [{ srcset: identityAssetUrl('avatar.avif', profile.avatarVersion), type: 'image/avif' }];
}

export const bannerSizes = {
    'banner.avif': { width: 1280, height: 640 },
    'banner.webp': { width: 1280, height: 640 },
    'banner-og.webp': { width: 1200, height: 630 }
} as const;

export type BannerAssetName = keyof typeof bannerSizes;

export function siteBannerOgUrl(profile?: { bannerVersion?: string | null } | null) {
    return identityAssetUrl('banner-og.webp', profile?.bannerVersion);
}

export function siteBannerSource(profile?: { bannerVersion?: string | null } | null) {
    return identityAssetUrl('banner.webp', profile?.bannerVersion);
}

export function publicBannerOgUrl(
    profile?: { bannerVersion?: string | null; siteUrl?: string } | null
) {
    const source = siteBannerOgUrl(profile);
    if (!source || !profile?.siteUrl) return '';
    return new URL(source, profile.siteUrl).href;
}

export function siteBannerSources(profile?: { bannerVersion?: string | null } | null) {
    if (!profile?.bannerVersion) return [];
    return [
        { srcset: identityAssetUrl('banner.avif', profile.bannerVersion), type: 'image/avif' },
        { srcset: identityAssetUrl('banner.webp', profile.bannerVersion), type: 'image/webp' }
    ];
}

export const iconSizes = {
    'avatar.png': 512,
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512
} as const;

export const avatarAssetNames = [
    ...Object.keys(iconSizes),
    'favicon.ico',
    'favicon.svg',
    'avatar.avif',
    'avatar.webp'
];

export const bannerAssetNames = Object.keys(bannerSizes);

export const identityAssetNames = [...avatarAssetNames, ...bannerAssetNames];

export type { ManifestSettings } from '@idstead/domain/author.ts';

export interface IdentityAsset {
    name: string;
    key: string;
    type: string;
    width: number;
    height: number;
    bytes: number;
    sha256: string;
}

export interface SvgPath {
    d: string;
    fill: string;
    opacity: number;
}

export interface ImagePackage {
    files: Record<string, ArrayBuffer>;
    paths: SvgPath[];
}

export function buildSvg(paths: SvgPath[]): string {
    if (!Array.isArray(paths) || !paths.length || paths.length > 10_000) {
        throw new Error('Invalid vector paths.');
    }
    const content = paths
        .map(path => {
            if (
                typeof path.d !== 'string'
                || path.d.length > 100_000
                || !/^[MLQZCHVmlqzchv0-9.,\s-]+$/.test(path.d)
                || !/^#[0-9a-f]{6}$/i.test(path.fill)
                || !Number.isFinite(path.opacity)
                || path.opacity < 0
                || path.opacity > 1
            )
                throw new Error('Invalid vector path.');
            return `<path fill="${path.fill}" opacity="${path.opacity}" d="${path.d}"/>`;
        })
        .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${content}</svg>`;
    if (new TextEncoder().encode(svg).length > IMAGE_LIMIT)
        throw new Error('Vector icon exceeds 500 KB.');
    return svg;
}

export function makeIco(images: { size: number; data: ArrayBuffer }[]): ArrayBuffer {
    const offset = 6 + images.length * 16;
    const result = new Uint8Array(
        offset + images.reduce((sum, image) => sum + image.data.byteLength, 0)
    );
    const view = new DataView(result.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, images.length, true);
    let position = offset;
    images.forEach((image, index) => {
        const entry = 6 + index * 16;
        view.setUint8(entry, image.size);
        view.setUint8(entry + 1, image.size);
        view.setUint16(entry + 4, 1, true);
        view.setUint16(entry + 6, 32, true);
        view.setUint32(entry + 8, image.data.byteLength, true);
        view.setUint32(entry + 12, position, true);
        result.set(new Uint8Array(image.data), position);
        position += image.data.byteLength;
    });
    return result.buffer;
}
