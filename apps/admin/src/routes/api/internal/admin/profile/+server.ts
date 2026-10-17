import { json } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import type { RequestHandler } from './$types';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { validateAvatar } from '#lib/server/validateAvatar.ts';
import {
    parseIdentityMeta,
    validateSiteBanner,
    type IdentityMeta
} from '#lib/server/validateSiteBanner.ts';
import {
    writeAssets,
    copyAssets,
    removeAssets,
    cleanupAssets,
    promoteIdentity
} from '#lib/server/profileAssets.ts';
import { profilePatch, ProfileInputError } from '#lib/server/profilePatch.ts';
import { avatarAssetNames, bannerAssetNames, type IdentityAsset } from '#lib/siteIdentity.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { workerBinding, type RateLimit } from '#lib/server/workerEnv.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

const attempts = new Map<string, number>();

type IdentityKind = 'avatar' | 'banner';

interface VersionRow {
    id: string;
    kind: IdentityKind | 'identity';
    source: IdentityMeta['source'];
    fingerprint: string | null;
    avatar_source: IdentityMeta['source'] | null;
    avatar_fingerprint: string | null;
    banner_source: IdentityMeta['source'] | null;
    banner_fingerprint: string | null;
    assets: IdentityAsset[];
}

interface KeptGroup {
    kind: IdentityKind;
    assets: IdentityAsset[];
}

function groupMeta(row: VersionRow, kind: IdentityKind): IdentityMeta {
    if (row.kind !== 'identity') return { source: row.source, fingerprint: row.fingerprint };
    return {
        source: row[`${kind}_source`] ?? 'custom',
        fingerprint: row[`${kind}_fingerprint`] ?? null
    };
}

async function discardVersion(
    platform: App.Platform | undefined,
    db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
    version: string
) {
    try {
        await removeAssets(platform, version);
        await db.from('db_identity_versions').delete().eq('id', version);
    } catch (cleanupError) {
        Sentry.captureException(cleanupError);
    }
}

export const GET: RequestHandler = async ({ request, platform }) => {
    const authFailure = await requireAdminAuth(request, platform);
    if (authFailure) return authFailure;
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'PROFILE_STORAGE_UNAVAILABLE', 'Profile storage is unavailable.');
    const { data, error } = await db.rpc('db_identity_defaults');
    if (error)
        return apiError(503, 'PROFILE_STORAGE_UNAVAILABLE', 'Profile storage is unavailable.');
    return json({ manifestSettings: data }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request, platform, url, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authFailure = await requireAdminAuth(request, platform);
    if (authFailure) return authFailure;
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'PROFILE_STORAGE_UNAVAILABLE', 'Profile storage is unavailable.');
    const {
        data: { user }
    } = await db.auth.getUser(
        request.headers
            .get('authorization')!
            .replace(/^Bearer\s+/i, '')
            .trim()
    );
    if (!user) return apiError(401, 'PROFILE_SESSION_EXPIRED', 'Please sign in again.');
    const now = Date.now();
    for (const [key, expiry] of attempts) if (expiry < now) attempts.delete(key);
    const limiter = await workerBinding<RateLimit>('API_RATE_LIMITER');
    if (
        (limiter && !(await limiter.limit({ key: `profile-upload:${user.id}` })).success)
        || (attempts.get(user.id) ?? 0) > now
    )
        return apiError(429, 'PROFILE_UPLOAD_RATE_LIMITED', 'Please wait before saving again.');
    attempts.set(user.id, now + 3000);
    let form: FormData;
    let payload: Record<string, unknown>;
    let files: Record<string, ArrayBuffer> | null;
    let bannerFiles: Record<string, ArrayBuffer> | null;
    let meta: { avatar: IdentityMeta; banner: IdentityMeta };
    const kept: KeptGroup[] = [];
    try {
        const reader = request.body?.getReader();
        if (!reader) throw new Error('Missing profile data.');
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                length += value.byteLength;
                if (length > 6_000_000) {
                    await reader.cancel();
                    return apiError(
                        413,
                        'PROFILE_UPLOAD_TOO_LARGE',
                        'The image packages are too large.'
                    );
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        form = await new Response(bytes, {
            headers: { 'Content-Type': request.headers.get('content-type') ?? '' }
        }).formData();
        const raw = form.get('profile');
        if (typeof raw !== 'string' || raw.length > 20_000 || form.getAll('profile').length !== 1)
            throw new Error('Invalid profile data.');
        payload = JSON.parse(raw);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
            throw new Error('Invalid profile data.');
        if (!Number.isSafeInteger(payload.revision) || Number(payload.revision) < 0)
            throw new Error('Reload the profile before saving.');
        if (
            payload.id !== null
            && (typeof payload.id !== 'string'
                || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    payload.id
                ))
        )
            throw new Error('Invalid profile.');
        let current = null;
        if (payload.id) {
            const result = await db
                .from('db_profiles')
                .select('*')
                .eq('id', payload.id)
                .maybeSingle();
            if (result.error)
                return apiError(
                    503,
                    'PROFILE_STORAGE_UNAVAILABLE',
                    'Profile storage is unavailable.'
                );
            current = result.data;
            if (!current || current.profile_revision !== payload.revision)
                return apiError(
                    409,
                    'PROFILE_REVISION_CONFLICT',
                    'The profile changed in another session. Reload before saving.'
                );
        }
        payload = profilePatch(payload, current);
        files = await validateAvatar(form);
        bannerFiles = await validateSiteBanner(form);
        meta = parseIdentityMeta(form);
        if (!files && !current?.avatar_version)
            throw new ProfileInputError({ avatar: 'Profile image is required.' });
        if (!bannerFiles && !current?.banner_version)
            throw new ProfileInputError({ banner: 'Website banner is required.' });
        if ((files || bannerFiles) && current) {
            const { data: rows, error: rowsError } = await db
                .from('db_identity_versions')
                .select(
                    'id, kind, source, fingerprint, avatar_source, avatar_fingerprint, banner_source, banner_fingerprint, assets'
                )
                .in('id', [current.avatar_version, current.banner_version].filter(Boolean));
            if (rowsError)
                return apiError(
                    503,
                    'PROFILE_STORAGE_UNAVAILABLE',
                    'Image metadata could not be prepared.'
                );
            const keep = (kind: IdentityKind, version: string, names: string[]) => {
                const row = (rows as VersionRow[] | null)?.find(entry => entry.id === version);
                const assets = (row?.assets ?? []).filter(asset => names.includes(asset.name));
                if (!row || assets.length !== names.length)
                    throw new ProfileInputError({
                        [kind]:
                            kind === 'avatar' ?
                                'Upload the profile image again to complete its image package.'
                            :   'Upload the website banner again to complete its image package.'
                    });
                meta[kind] = groupMeta(row, kind);
                kept.push({ kind, assets });
            };
            if (!files) keep('avatar', current.avatar_version, avatarAssetNames);
            if (!bannerFiles) keep('banner', current.banner_version, bannerAssetNames);
        }
    } catch (error) {
        return apiError(
            400,
            'PROFILE_INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid profile or image data.',
            error instanceof ProfileInputError ?
                JSON.stringify({ fields: error.fields })
            :   undefined
        );
    }
    const version = files || bannerFiles ? crypto.randomUUID() : null;
    let identity: { version: string; assets: IdentityAsset[] } | null = null;
    if (version) {
        const { error: registerError } = await db
            .from('db_identity_versions')
            .insert({
                id: version,
                kind: 'identity',
                source: meta.avatar.source,
                fingerprint: meta.avatar.fingerprint,
                avatar_source: meta.avatar.source,
                avatar_fingerprint: meta.avatar.fingerprint,
                banner_source: meta.banner.source,
                banner_fingerprint: meta.banner.fingerprint,
                assets: [],
                retired_at: new Date().toISOString()
            });
        if (registerError)
            return apiError(
                503,
                'PROFILE_STORAGE_UNAVAILABLE',
                'Image metadata could not be prepared.'
            );
        try {
            const assets = await writeAssets(platform, version, {
                ...(files ?? {}),
                ...(bannerFiles ?? {})
            });
            for (const group of kept)
                assets.push(...(await copyAssets(platform, version, group.assets)));
            identity = { version, assets };
        } catch (error) {
            Sentry.captureException(error);
            await discardVersion(platform, db, version);
            return apiError(
                502,
                'PROFILE_UPLOAD_FAILED',
                'Images could not be stored. Your current profile is unchanged.'
            );
        }
    }
    const { data, error } = await db.rpc('db_save_profile_identity', {
        p_profile: payload,
        p_identity: identity
    });
    if (error) {
        if (version) {
            const { data: committed, error: verifyError } = await db
                .from('db_profiles')
                .select('*')
                .eq('avatar_version', version)
                .maybeSingle();
            if (committed)
                return json(
                    {
                        success: true,
                        profile: committed,
                        cleanupPending: await cleanupAfterSave(platform, version)
                    },
                    { headers: { 'Cache-Control': 'no-store' } }
                );
            if (
                !verifyError
                && ['40001', '23505', '23502', '23503', '23514', '22P02', 'P0001'].includes(
                    error.code
                )
            )
                await discardVersion(platform, db, version);
        }
        if (error.code === '40001')
            return apiError(
                409,
                'PROFILE_REVISION_CONFLICT',
                'The profile changed in another session. Reload before saving.'
            );
        Sentry.captureException(error);
        return apiError(
            503,
            'PROFILE_SAVE_FAILED',
            'Profile could not be saved. Reload to check its current state before retrying.'
        );
    }
    const cleanupPending = await cleanupAfterSave(platform, version);
    const changedFields = Object.keys(payload).filter(key => !['id', 'revision'].includes(key));
    await logActivity(
        {
            actor: user.email ?? user.id,
            action: version ? 'profile.avatar_update' : 'profile.update',
            category: 'profile',
            summary:
                version ?
                    `Updated profile ${[files && 'image', bannerFiles && 'banner'].filter(Boolean).join(' and ')}${changedFields.length ? ` and ${changedFields.join(', ')}` : ''}.`
                :   `Updated ${changedFields.join(', ') || 'profile'}.`,
            details: {
                fields: changedFields,
                avatarUpdated: Boolean(files),
                bannerUpdated: Boolean(bannerFiles)
            },
            ip: (() => {
                try {
                    return getClientAddress();
                } catch {
                    return null;
                }
            })(),
            ipSalt: ipSalt(platform),
            userAgent: request.headers.get('user-agent') ?? undefined
        },
        db
    );
    return json(
        { success: true, profile: data, cleanupPending },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};

async function cleanupAfterSave(platform: App.Platform | undefined, version: string | null) {
    let pending = false;
    if (version) {
        try {
            const db = getSupabaseAdminClient(platform);
            if (!db) throw new Error('Database is not configured.');
            const { data, error } = await db
                .from('db_profiles')
                .select('avatar_version')
                .eq('avatar_version', version)
                .maybeSingle();
            if (error) throw error;
            if (data) await promoteIdentity(platform, version);
        } catch (error) {
            Sentry.captureException(error);
            pending = true;
        }
    }
    try {
        await cleanupAssets(platform);
    } catch (error) {
        Sentry.captureException(error);
        pending = true;
    }
    return pending;
}
