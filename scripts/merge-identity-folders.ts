import { readFileSync } from 'node:fs';
import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import encodeAvif, { init as initAvif } from '@jsquash/avif/encode.js';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js';
import UPNG from 'upng-js';
import { simd } from 'wasm-feature-detect';
import { inspectAvif } from '../packages/lib/src/avif';
import { inspectWebp } from '../packages/lib/src/webp';
import {
    IMAGE_LIMIT,
    avatarAssetNames,
    bannerAssetNames,
    identityAssetNames,
    type IdentityAsset
} from '../packages/lib/src/siteIdentity';

const mode = Bun.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'dry-run';
if (!['dry-run', 'apply'].includes(mode))
    throw new Error('Usage: merge-identity-folders.ts [dry-run|apply]');

const value = (name: string) => {
    const result = process.env[name];
    if (!result) throw new Error(`Missing configuration: ${name}`);
    return result;
};
const project = value('PUBLIC_SUPABASE_URL')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
const db = createClient(project, value('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
});
const bucket = value('R2_BUCKET_NAME');
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${value('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: value('R2_ACCESS_KEY_ID'),
        secretAccessKey: value('R2_SECRET_ACCESS_KEY')
    }
});

interface VersionRow {
    id: string;
    kind: string;
    source: 'custom' | 'generated';
    fingerprint: string | null;
    assets: IdentityAsset[];
}

const formats = ['avatar.avif', 'avatar.webp'];

const { data: profile, error: profileError } = await db
    .from('db_profiles')
    .select('id, profile_revision, avatar_version, banner_version')
    .order('created_at')
    .limit(1)
    .maybeSingle();
if (profileError) throw new Error(`Cannot read db_profiles: ${profileError.message}`);
if (!profile?.avatar_version || !profile.banner_version) {
    console.log('The profile has no avatar or banner version to merge.');
    process.exit(0);
}

const { data: rows, error: rowsError } = await db
    .from('db_identity_versions')
    .select('id, kind, source, fingerprint, assets')
    .in('id', [profile.avatar_version, profile.banner_version]);
if (rowsError) throw new Error(`Cannot read db_identity_versions: ${rowsError.message}`);
const avatarRow = (rows as VersionRow[]).find(row => row.id === profile.avatar_version);
const bannerRow = (rows as VersionRow[]).find(row => row.id === profile.banner_version);
if (!avatarRow || !bannerRow) throw new Error('The current identity versions are missing.');
if (avatarRow.id === bannerRow.id && avatarRow.kind === 'identity') {
    console.log(`Avatar and banner already share identity/${avatarRow.id}/.`);
    process.exit(0);
}

const kept = [
    ...avatarRow.assets
        .filter(asset => avatarAssetNames.includes(asset.name))
        .map(asset => ({ from: avatarRow.id, asset })),
    ...bannerRow.assets
        .filter(asset => bannerAssetNames.includes(asset.name))
        .map(asset => ({ from: bannerRow.id, asset }))
];
const keptNames = new Set(kept.map(entry => entry.asset.name));
const missing = identityAssetNames.filter(name => !keptNames.has(name));
const unsupported = missing.filter(name => !formats.includes(name));
if (unsupported.length) throw new Error(`Cannot rebuild ${unsupported.join(', ')}.`);

async function read(key: string) {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) throw new Error(`Empty object: ${key}`);
    return object.Body.transformToByteArray();
}

async function sha256(bytes: Uint8Array) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

const created: Record<string, Uint8Array> = {};
if (missing.length) {
    const png = await read(`identity/${avatarRow.id}/avatar.png`);
    const decoded = UPNG.decode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
    if (decoded.width !== 512 || decoded.height !== 512)
        throw new Error('avatar.png is not 512 × 512.');
    const pixels = {
        data: new Uint8ClampedArray(UPNG.toRGBA8(decoded)[0]),
        width: 512,
        height: 512,
        colorSpace: 'srgb'
    } as ImageData;
    const wasm = (spec: string) =>
        WebAssembly.compile(readFileSync(Bun.resolveSync(spec, import.meta.dir)));
    if (missing.includes('avatar.avif')) {
        await initAvif(await wasm('@jsquash/avif/codec/enc/avif_enc.wasm'));
        created['avatar.avif'] = new Uint8Array(await encodeAvif(pixels));
        inspectAvif(created['avatar.avif'], { maxBytes: IMAGE_LIMIT, width: 512, height: 512 });
    }
    if (missing.includes('avatar.webp')) {
        await initWebp(
            await wasm(
                (await simd()) ?
                    '@jsquash/webp/codec/enc/webp_enc_simd.wasm'
                :   '@jsquash/webp/codec/enc/webp_enc.wasm'
            )
        );
        created['avatar.webp'] = new Uint8Array(await encodeWebp(pixels, { quality: 80 }));
        inspectWebp(created['avatar.webp'], { maxBytes: IMAGE_LIMIT, width: 512, height: 512 });
    }
}

console.log(`Profile image:   identity/${avatarRow.id}/ (${avatarRow.kind})`);
console.log(`Website banner:  identity/${bannerRow.id}/ (${bannerRow.kind})`);
for (const { from, asset } of kept) console.log(`  copy   identity/${from}/${asset.name}`);
for (const [name, bytes] of Object.entries(created))
    console.log(`  create ${name} (${bytes.byteLength} bytes)`);

if (mode === 'dry-run') {
    console.log(
        `\nDry run: ${kept.length} file(s) would be copied and ${Object.keys(created).length} created in one new folder. Run with "apply" to save.`
    );
    process.exit(0);
}

const version = crypto.randomUUID();
const { error: registerError } = await db
    .from('db_identity_versions')
    .insert({
        id: version,
        kind: 'identity',
        source: avatarRow.source,
        fingerprint: avatarRow.fingerprint,
        avatar_source: avatarRow.source,
        avatar_fingerprint: avatarRow.fingerprint,
        banner_source: bannerRow.source,
        banner_fingerprint: bannerRow.fingerprint,
        assets: [],
        retired_at: new Date().toISOString()
    });
if (registerError) throw new Error(`Cannot stage the new version: ${registerError.message}`);

async function removeFolder(id: string) {
    await Promise.all(
        identityAssetNames.map(name =>
            r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: `identity/${id}/${name}` }))
        )
    );
}

try {
    const assets: IdentityAsset[] = [];
    for (const { from, asset } of kept) {
        const key = `identity/${version}/${asset.name}`;
        await r2.send(
            new CopyObjectCommand({
                Bucket: bucket,
                Key: key,
                CopySource: `${bucket}/identity/${from}/${asset.name}`,
                MetadataDirective: 'COPY'
            })
        );
        assets.push({ ...asset, key });
    }
    for (const [name, bytes] of Object.entries(created)) {
        const key = `identity/${version}/${name}`;
        const type = name.endsWith('.avif') ? 'image/avif' : 'image/webp';
        await r2.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: bytes,
                ContentType: type,
                CacheControl: 'public, max-age=31536000, immutable'
            })
        );
        assets.push({
            name,
            key,
            type,
            width: 512,
            height: 512,
            bytes: bytes.byteLength,
            sha256: await sha256(bytes)
        });
    }
    const { error: saveError } = await db.rpc('db_save_profile_identity', {
        p_profile: { id: profile.id, revision: profile.profile_revision },
        p_identity: { version, assets }
    });
    if (saveError) throw new Error(`Cannot save the profile: ${saveError.message}`);
} catch (error) {
    const { data: committed } = await db
        .from('db_profiles')
        .select('id')
        .eq('avatar_version', version)
        .maybeSingle();
    if (!committed) {
        await removeFolder(version);
        await db.from('db_identity_versions').delete().eq('id', version);
    }
    throw error;
}
console.log(`\nAvatar and banner now share identity/${version}/.`);

const { data: claimed, error: claimError } = await db.rpc('db_claim_identity_cleanup');
if (claimError) throw new Error(`Cannot claim old versions: ${claimError.message}`);
for (const { id } of (claimed ?? []) as { id: string }[]) {
    await removeFolder(id);
    const { error: deleteError } = await db.from('db_identity_versions').delete().eq('id', id);
    if (deleteError) throw new Error(`Cannot delete version ${id}: ${deleteError.message}`);
    console.log(`Removed identity/${id}/.`);
}
