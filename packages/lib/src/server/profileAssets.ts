// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as publicEnv from '$app/env/public';
import { dataStores } from './data';
import { identityVersionToken } from '@idstead/domain/hash.ts';
import { assetBucket, copyObject } from './r2';
import {
    bannerSizes,
    iconSizes,
    identityAssetNames,
    type IdentityAsset
} from '#lib/siteIdentity.ts';

export const assetNames = identityAssetNames;

const VERSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const IMAGE_CACHE_CONTROL = 'public, max-age=300';
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const contentTypes: Record<string, string> = {
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    avif: 'image/avif',
    png: 'image/png'
};

function isBanner(name: string) {
    return name in bannerSizes;
}

function assetDimensions(name: string) {
    if (name in bannerSizes) return bannerSizes[name as keyof typeof bannerSizes];
    const size =
        iconSizes[name as keyof typeof iconSizes]
        ?? (name.startsWith('avatar.') ? 512
        : name.endsWith('.svg') ? 128
        : 48);
    return { width: size, height: size };
}

function contentTypeOf(name: string) {
    return contentTypes[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
}

export async function writeAssets(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string,
    files: Record<string, ArrayBuffer>
): Promise<IdentityAsset[]> {
    const bucket = await assetBucket(platform);
    const assets: IdentityAsset[] = [];
    for (const [name, bytes] of Object.entries(files)) {
        const type = contentTypeOf(name);
        const key = `identity/${version}/${name}`;
        const sha = await crypto.subtle.digest('SHA-256', bytes);
        await bucket.put(key, bytes, {
            httpMetadata: { contentType: type, cacheControl: IMAGE_CACHE_CONTROL }
        });
        assets.push({
            name,
            key,
            type,
            ...assetDimensions(name),
            bytes: bytes.byteLength,
            sha256: Array.from(new Uint8Array(sha), b => b.toString(16).padStart(2, '0')).join('')
        });
    }
    return assets;
}

export async function copyAssets(
    platform: Pick<App.Platform, 'env'> | undefined,
    to: string,
    assets: IdentityAsset[]
): Promise<IdentityAsset[]> {
    if (!VERSION_PATTERN.test(to)) throw new Error('Invalid identity version.');
    const bucket = await assetBucket(platform);
    const copied: IdentityAsset[] = [];
    for (const asset of assets) {
        if (!assetNames.includes(asset.name)) throw new Error('Invalid identity asset.');
        const key = `identity/${to}/${asset.name}`;
        await copyObject(bucket, `identity/${asset.name}`, key);
        copied.push({ ...asset, key });
    }
    return copied;
}

export async function promoteIdentity(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string
) {
    if (!VERSION_PATTERN.test(version)) throw new Error('Invalid identity version.');
    const bucket = await assetBucket(platform);
    for (const name of assetNames)
        await copyObject(bucket, `identity/${version}/${name}`, `identity/${name}`, {
            contentType: contentTypeOf(name),
            cacheControl: IMAGE_CACHE_CONTROL
        });
    await removeAssets(platform, version);
}

export async function removeCanonicalIdentity(platform: Pick<App.Platform, 'env'> | undefined) {
    const bucket = await assetBucket(platform);
    await bucket.delete(assetNames.map(name => `identity/${name}`));
}

export async function removeAssets(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string
) {
    const bucket = await assetBucket(platform);
    await bucket.delete(assetNames.map(name => `identity/${version}/${name}`));
}

export async function cleanupAssets(platform?: Pick<App.Platform, 'env'>) {
    const store = dataStores(platform).service?.adminAuthor;
    if (!store) throw new Error('Database is not configured.');
    const versions = await store.claimIdentityCleanup();
    for (const version of versions) {
        await removeAssets(platform, version);
        await store.deleteIdentityVersion(version);
    }
    return versions.length;
}

export async function readAvatarBytes(
    platform: Pick<App.Platform, 'env'> | undefined,
    version?: string | null
): Promise<Uint8Array | null> {
    if (!version || !VERSION_PATTERN.test(version)) return null;
    try {
        const object = await readIdentityObject(platform, version, 'avatar.png');
        return object ? new Uint8Array(await object.arrayBuffer()) : null;
    } catch (error) {
        console.warn('Avatar could not be read for resume generation:', error);
        return null;
    }
}

export async function readIdentityObject(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string,
    name: string
) {
    if (!VERSION_PATTERN.test(version) || !assetNames.includes(name))
        throw new Error('Invalid identity asset.');
    const bucket = await assetBucket(platform);
    return (
        (await bucket.get(`identity/${version}/${name}`)) ?? (await bucket.get(`identity/${name}`))
    );
}

export async function serveIdentityAsset(
    request: Request,
    url: URL,
    platform?: Pick<App.Platform, 'env'>
): Promise<Response> {
    const name = url.pathname === '/hero.png' ? 'avatar.png' : url.pathname.slice(1);
    const missing = () =>
        new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (!assetNames.includes(name)) return missing();
    const versions = await dataStores(platform)
        .public.identity.current()
        .catch(() => null);
    if (!versions)
        return new Response('Image metadata unavailable.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' }
        });
    const version = isBanner(name) ? versions.banner : versions.avatar;
    if (!version) {
        const base = String(
            platform?.env?.PUBLIC_CDN_BASE_URL ?? publicEnv.PUBLIC_CDN_BASE_URL ?? ''
        ).replace(/\/+$/, '');
        if (
            !base
            || isBanner(name)
            || name === 'favicon.svg'
            || (name === 'avatar.png' && url.pathname !== '/hero.png')
        )
            return missing();
        const upstream = await fetch(`${base}/${url.pathname === '/hero.png' ? 'hero.png' : name}`);
        return new Response(request.method === 'HEAD' ? null : upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
                'Cache-Control': IMAGE_CACHE_CONTROL
            }
        });
    }
    const object = await readIdentityObject(platform, version, name);
    if (!object) return missing();
    const headers = new Headers({
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':
            url.searchParams.get('v') === (await identityVersionToken(version)) ?
                IMMUTABLE_CACHE_CONTROL
            :   IMAGE_CACHE_CONTROL,
        ETag: object.httpEtag
    });
    if (name.endsWith('.svg'))
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'none'; sandbox");
    const matched = request.headers
        .get('if-none-match')
        ?.split(',')
        .some(v => v.trim().replace(/^W\//, '') === object.httpEtag || v.trim() === '*');
    if (matched) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(object.body, { headers });
}
