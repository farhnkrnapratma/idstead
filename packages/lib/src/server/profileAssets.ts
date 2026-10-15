import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    CopyObjectCommand
} from '@aws-sdk/client-s3';
import * as env from '$app/env/private';
import * as publicEnv from '$app/env/public';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { supabase } from '#lib/supabase.ts';
import {
    bannerSizes,
    iconSizes,
    identityAssetNames,
    type IdentityAsset
} from '#lib/siteIdentity.ts';

export const assetNames = identityAssetNames;

const VERSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const IMAGE_CACHE_CONTROL = 'public, max-age=300';

const contentTypes: Record<string, string> = {
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    avif: 'image/avif',
    png: 'image/png'
};

function versionColumn(name: string) {
    return name in bannerSizes ? 'banner_version' : 'avatar_version';
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

type StorageEnvKey =
    'R2_ACCOUNT_ID' | 'R2_BUCKET_NAME' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY';

export function assetStorage(platform?: Pick<App.Platform, 'env'>) {
    const value = (key: StorageEnvKey) => String(platform?.env?.[key] ?? env[key] ?? '');
    const account = value('R2_ACCOUNT_ID');
    const bucket = value('R2_BUCKET_NAME');
    const accessKeyId = value('R2_ACCESS_KEY_ID');
    const secretAccessKey = value('R2_SECRET_ACCESS_KEY');
    if (!account || !bucket || !accessKeyId || !secretAccessKey)
        throw new Error('Image storage is not configured.');
    return {
        bucket,
        client: new S3Client({
            region: 'auto',
            endpoint: `https://${account}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey }
        })
    };
}

export async function writeAssets(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string,
    files: Record<string, ArrayBuffer>
): Promise<IdentityAsset[]> {
    const { bucket, client } = assetStorage(platform);
    const assets: IdentityAsset[] = [];
    for (const [name, bytes] of Object.entries(files)) {
        const type = contentTypes[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
        const key = `identity/${version}/${name}`;
        const sha = await crypto.subtle.digest('SHA-256', bytes);
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: new Uint8Array(bytes),
                ContentType: type,
                CacheControl: IMAGE_CACHE_CONTROL
            })
        );
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
    const { bucket, client } = assetStorage(platform);
    const copied: IdentityAsset[] = [];
    for (const asset of assets) {
        if (!assetNames.includes(asset.name)) throw new Error('Invalid identity asset.');
        const key = `identity/${to}/${asset.name}`;
        await client.send(
            new CopyObjectCommand({
                Bucket: bucket,
                Key: key,
                CopySource: `${bucket}/identity/${asset.name}`,
                MetadataDirective: 'COPY'
            })
        );
        copied.push({ ...asset, key });
    }
    return copied;
}

export async function promoteIdentity(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string
) {
    if (!VERSION_PATTERN.test(version)) throw new Error('Invalid identity version.');
    const { bucket, client } = assetStorage(platform);
    for (const name of assetNames)
        await client.send(
            new CopyObjectCommand({
                Bucket: bucket,
                Key: `identity/${name}`,
                CopySource: `${bucket}/identity/${version}/${name}`,
                MetadataDirective: 'REPLACE',
                ContentType:
                    contentTypes[name.split('.').pop() ?? ''] ?? 'application/octet-stream',
                CacheControl: IMAGE_CACHE_CONTROL
            })
        );
    await removeAssets(platform, version);
}

export async function removeCanonicalIdentity(platform: Pick<App.Platform, 'env'> | undefined) {
    const { bucket, client } = assetStorage(platform);
    await Promise.all(
        assetNames.map(name =>
            client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `identity/${name}` }))
        )
    );
}

export async function removeAssets(
    platform: Pick<App.Platform, 'env'> | undefined,
    version: string
) {
    const { bucket, client } = assetStorage(platform);
    await Promise.all(
        assetNames.map(name =>
            client.send(
                new DeleteObjectCommand({ Bucket: bucket, Key: `identity/${version}/${name}` })
            )
        )
    );
}

export async function cleanupAssets(platform?: Pick<App.Platform, 'env'>) {
    const db = getSupabaseAdminClient(platform);
    if (!db) throw new Error('Database is not configured.');
    const { data, error } = await db.rpc('db_claim_identity_cleanup');
    if (error) throw error;
    for (const version of data ?? []) {
        await removeAssets(platform, version.id);
        const { error: failure } = await db
            .from('db_identity_versions')
            .delete()
            .eq('id', version.id);
        if (failure) throw failure;
    }
    return data?.length ?? 0;
}

export async function readAvatarBytes(
    platform: Pick<App.Platform, 'env'> | undefined,
    version?: string | null
): Promise<Uint8Array | null> {
    if (!version || !VERSION_PATTERN.test(version)) return null;
    try {
        const object = await readIdentityObject(platform, version, 'avatar.png');
        return object?.Body ? await object.Body.transformToByteArray() : null;
    } catch (error) {
        console.warn('Avatar could not be read for CV generation:', error);
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
    const { bucket, client } = assetStorage(platform);
    try {
        return await client.send(new GetObjectCommand({ Bucket: bucket, Key: `identity/${name}` }));
    } catch (error) {
        if (!(error instanceof Error) || error.name !== 'NoSuchKey') throw error;
    }
    try {
        return await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: `identity/${version}/${name}` })
        );
    } catch (error) {
        if (error instanceof Error && error.name === 'NoSuchKey') return null;
        throw error;
    }
}

export async function serveIdentityAsset(
    request: Request,
    url: URL,
    platform?: Pick<App.Platform, 'env'>
): Promise<Response> {
    const name = url.pathname === '/hero.png' ? 'avatar.png' : url.pathname.slice(1);
    const missing = () =>
        new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (!assetNames.includes(name) || url.searchParams.has('v')) return missing();
    const column = versionColumn(name);
    const { data, error } = await supabase
        .from('db_profiles')
        .select(column)
        .order('created_at')
        .limit(1)
        .maybeSingle();
    if (error)
        return new Response('Image metadata unavailable.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' }
        });
    const version = (data as Record<string, string | null> | null)?.[column] ?? null;
    if (!version) {
        const base = String(
            platform?.env?.PUBLIC_CDN_BASE_URL ?? publicEnv.PUBLIC_CDN_BASE_URL ?? ''
        ).replace(/\/+$/, '');
        if (
            !base
            || column === 'banner_version'
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
        'Content-Type': object.ContentType ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': IMAGE_CACHE_CONTROL
    });
    if (object.ETag) headers.set('ETag', object.ETag);
    if (name.endsWith('.svg'))
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'none'; sandbox");
    const matched =
        object.ETag
        && request.headers
            .get('if-none-match')
            ?.split(',')
            .some(v => v.trim().replace(/^W\//, '') === object.ETag || v.trim() === '*');
    if (matched) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { headers });
    const bytes = await object.Body?.transformToByteArray();
    return new Response(bytes ? new Uint8Array(bytes).buffer : null, { headers });
}
