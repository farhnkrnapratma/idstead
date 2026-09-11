import {json} from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import type {RequestHandler} from './$types';
import {requireAdminAuth} from '$lib/server/adminCv';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {apiError} from '$lib/server/apiError';
import {validateAvatar} from '$lib/server/validateAvatar';
import {
  writeAssets,
  removeAssets,
  cleanupAssets
} from '$lib/server/profileAssets';
import {profilePatch, ProfileInputError} from '$lib/server/profilePatch';
import type {IdentityAsset} from '$lib/siteIdentity';

const attempts = new Map<string, number>();

export const GET: RequestHandler = async ({request, platform}) => {
  const authFailure = await requireAdminAuth(request, platform);
  if (authFailure) return authFailure;
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'PROFILE_STORAGE_UNAVAILABLE',
      'Profile storage is unavailable.'
    );
  const {data, error} = await db.rpc('db_identity_defaults');
  if (error)
    return apiError(
      503,
      'PROFILE_STORAGE_UNAVAILABLE',
      'Profile storage is unavailable.'
    );
  return json(
    {manifestSettings: data},
    {headers: {'Cache-Control': 'no-store'}}
  );
};

export const POST: RequestHandler = async ({request, platform, url}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(
      403,
      'PROFILE_ORIGIN_FORBIDDEN',
      'Cross-origin requests are forbidden.'
    );
  const authFailure = await requireAdminAuth(request, platform);
  if (authFailure) return authFailure;
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'PROFILE_STORAGE_UNAVAILABLE',
      'Profile storage is unavailable.'
    );
  const {
    data: {user}
  } = await db.auth.getUser(
    request.headers
      .get('authorization')!
      .replace(/^Bearer\s+/i, '')
      .trim()
  );
  if (!user)
    return apiError(401, 'PROFILE_SESSION_EXPIRED', 'Please sign in again.');
  const now = Date.now();
  for (const [key, expiry] of attempts) if (expiry < now) attempts.delete(key);
  const limiter = platform?.env?.API_RATE_LIMITER;
  if (
    (limiter
      && !(await limiter.limit({key: `profile-upload:${user.id}`})).success)
    || (attempts.get(user.id) ?? 0) > now
  )
    return apiError(
      429,
      'PROFILE_UPLOAD_RATE_LIMITED',
      'Please wait before saving again.'
    );
  attempts.set(user.id, now + 3000);
  let form: FormData;
  let payload: Record<string, unknown>;
  let files: Record<string, ArrayBuffer> | null;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing profile data.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 4_100_000) {
          await reader.cancel();
          return apiError(
            413,
            'PROFILE_UPLOAD_TOO_LARGE',
            'The icon package is too large.'
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
      headers: {'Content-Type': request.headers.get('content-type') ?? ''}
    }).formData();
    const raw = form.get('profile');
    if (
      typeof raw !== 'string'
      || raw.length > 20_000
      || form.getAll('profile').length !== 1
    )
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
  } catch (error) {
    return apiError(
      400,
      'PROFILE_INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid profile or image data.',
      error instanceof ProfileInputError ?
        JSON.stringify({fields: error.fields})
      : undefined
    );
  }
  let version: string | null = null;
  let assets: IdentityAsset[] = [];
  if (files) {
    version = crypto.randomUUID();
    const {error: registerError} = await db
      .from('db_identity_versions')
      .insert({id: version, assets: [], retired_at: new Date().toISOString()});
    if (registerError)
      return apiError(
        503,
        'PROFILE_STORAGE_UNAVAILABLE',
        'Image metadata could not be prepared.'
      );
    try {
      assets = await writeAssets(platform, version, files);
    } catch (error) {
      Sentry.captureException(error);
      try {
        await removeAssets(platform, version);
        await db.from('db_identity_versions').delete().eq('id', version);
      } catch (cleanupError) {
        Sentry.captureException(cleanupError);
      }
      return apiError(
        502,
        'PROFILE_UPLOAD_FAILED',
        'Images could not be stored. Your current profile is unchanged.'
      );
    }
  }
  const {data, error} = await db.rpc('db_commit_profile_identity', {
    p_profile: payload,
    p_version: version,
    p_assets: assets
  });
  if (error) {
    if (version) {
      const {data: committed, error: verifyError} = await db
        .from('db_profiles')
        .select('*')
        .eq('avatar_version', version)
        .maybeSingle();
      if (committed)
        return json(
          {
            success: true,
            profile: committed,
            cleanupPending: await cleanupAfterSave(platform)
          },
          {headers: {'Cache-Control': 'no-store'}}
        );
      if (
        !verifyError
        && [
          '40001',
          '23505',
          '23502',
          '23503',
          '23514',
          '22P02',
          'P0001'
        ].includes(error.code)
      ) {
        try {
          await removeAssets(platform, version);
          await db.from('db_identity_versions').delete().eq('id', version);
        } catch (cleanupError) {
          Sentry.captureException(cleanupError);
        }
      }
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
  const cleanupPending = await cleanupAfterSave(platform);
  return json(
    {success: true, profile: data, cleanupPending},
    {headers: {'Cache-Control': 'no-store'}}
  );
};

async function cleanupAfterSave(platform?: App.Platform) {
  try {
    await cleanupAssets(platform);
    return false;
  } catch (error) {
    Sentry.captureException(error);
    return true;
  }
}
