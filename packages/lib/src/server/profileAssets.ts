import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand
} from '@aws-sdk/client-s3';
import * as env from '$app/env/private';
import * as publicEnv from '$app/env/public';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { supabase } from '#lib/supabase.ts';
import { iconSizes, type IdentityAsset } from '#lib/siteIdentity.ts';

export const assetNames = [
    ...Object.keys(iconSizes),
    'favicon.ico',
    'favicon.svg',
    'avatar.avif',
    'avatar.webp'
];

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
        const type =
            name.endsWith('.svg') ? 'image/svg+xml'
            : name.endsWith('.ico') ? 'image/x-icon'
            : 'image/png';
        const key = `identity/${version}/${name}`;
        const sha = await crypto.subtle.digest('SHA-256', bytes);
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: new Uint8Array(bytes),
                ContentType: type,
                CacheControl: 'public, max-age=31536000, immutable'
            })
        );
        const size =
            iconSizes[name as keyof typeof iconSizes] ?? (name.endsWith('.svg') ? 128 : 48);
        assets.push({
            name,
            key,
            type,
            width: size,
            height: size,
            bytes: bytes.byteLength,
            sha256: Array.from(new Uint8Array(sha), b => b.toString(16).padStart(2, '0')).join('')
        });
    }
    return assets;
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
    if (!version || !/^[0-9a-f-]{36}$/i.test(version)) return null;
    try {
        const { bucket, client } = assetStorage(platform);
        const object = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: `identity/${version}/avatar.png` })
        );
        return object.Body ? await object.Body.transformToByteArray() : null;
    } catch (error) {
        console.warn('Avatar could not be read for CV generation:', error);
        return null;
    }
}

export async function serveIdentityAsset(
    request: Request,
    url: URL,
    platform?: Pick<App.Platform, 'env'>
): Promise<Response> {
    const name = url.pathname === '/hero.png' ? 'avatar.png' : url.pathname.slice(1);
    if (!assetNames.includes(name)) return new Response(null, { status: 404 });
    let version = url.searchParams.get('v');
    if (version && !/^[0-9a-f-]{36}$/i.test(version)) return new Response(null, { status: 404 });
    if (!version) {
        const { data, error } = await supabase
            .from('db_profiles')
            .select('avatar_version')
            .order('created_at')
            .limit(1)
            .maybeSingle();
        if (error)
            return new Response('Image metadata unavailable.', {
                status: 503,
                headers: { 'Cache-Control': 'no-store' }
            });
        version = data?.avatar_version;
    }
    if (!version) {
        const base = String(
            platform?.env?.PUBLIC_CDN_BASE_URL ?? publicEnv.PUBLIC_CDN_BASE_URL ?? ''
        ).replace(/\/+$/, '');
        if (
            !base
            || name === 'favicon.svg'
            || (name === 'avatar.png' && url.pathname !== '/hero.png')
        )
            return new Response(null, { status: 404 });
        const upstream = await fetch(`${base}/${url.pathname === '/hero.png' ? 'hero.png' : name}`);
        return new Response(request.method === 'HEAD' ? null : upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
                'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate'
            }
        });
    }
    const { bucket, client } = assetStorage(platform);
    try {
        const object = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: `identity/${version}/${name}` })
        );
        const versioned = url.searchParams.has('v');
        const headers = new Headers({
            'Content-Type': object.ContentType ?? 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control':
                versioned ?
                    'public, max-age=31536000, immutable'
                :   'public, max-age=0, s-maxage=60, must-revalidate'
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
    } catch (error) {
        if (error instanceof Error && error.name === 'NoSuchKey') {
            const { data, error: lookupError } = await supabase
                .from('db_profiles')
                .select('avatar_version')
                .order('created_at')
                .limit(1)
                .maybeSingle();
            if (lookupError) throw lookupError;
            if (data?.avatar_version && data.avatar_version !== version) {
                return new Response(null, {
                    status: 307,
                    headers: {
                        Location: `${url.pathname}?v=${data.avatar_version}`,
                        'Cache-Control': 'no-store'
                    }
                });
            }
            return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
        }
        throw error;
    }
}
