import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {isSameOriginRequest} from '#lib/server/sameOrigin.ts';
import {apiError} from '#lib/server/apiError.ts';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {requireAdminAuth, deleteCvFile} from '#lib/server/adminCv.ts';
import {removeAssets} from '#lib/server/profileAssets.ts';
import {cleanupBlogAssets} from '#lib/server/blogBannerStorage.ts';
import {bearerToken} from '#lib/server/adminAuth.ts';
import {logActivity} from '#lib/server/activityLog.ts';
import {supabase} from '#lib/supabase.ts';
import * as privateEnv from '$app/env/private';

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'DATA_STORAGE_UNAVAILABLE',
      'Data storage is unavailable.'
    );

  const token = bearerToken(request);
  const actorEmail =
    token ? (await db.auth.getUser(token)).data.user?.email : null;
  if (!actorEmail)
    return apiError(
      401,
      'DATA_DELETE_AUTH_REQUIRED',
      'Admin session is invalid.'
    );

  let password = '';
  try {
    const body = await request.json();
    if (typeof body?.password === 'string') password = body.password;
  } catch {
    password = '';
  }
  if (!password)
    return apiError(
      400,
      'DATA_DELETE_PASSWORD_REQUIRED',
      'Enter your password to confirm.'
    );

  const {error: passwordError} = await supabase.auth.signInWithPassword({
    email: actorEmail,
    password
  });
  if (passwordError)
    return apiError(401, 'DATA_DELETE_PASSWORD_INVALID', 'Incorrect password.');

  const {data: profile} = await db
    .from('db_profiles')
    .select('id')
    .limit(1)
    .maybeSingle();

  let documents: {filename: string}[] = [];
  let identityVersions: {id: string}[] = [];
  if (profile?.id) {
    const [
      {data: documentsData, error: documentsError},
      {data: versionsData, error: versionsError}
    ] = await Promise.all([
      db.from('db_documents').select('filename').eq('author_id', profile.id),
      db.from('db_identity_versions').select('id').eq('profile_id', profile.id)
    ]);
    if (documentsError || versionsError)
      return apiError(
        503,
        'DATA_DELETE_FAILED',
        'Could not load profile files. No data was deleted.'
      );
    documents = documentsData ?? [];
    identityVersions = versionsData ?? [];
  }

  const {error} = await db.rpc('db_clear_all_data');
  if (error)
    return apiError(503, 'DATA_DELETE_FAILED', 'Could not clear site data.');

  let cleanupFailed = false;
  for (const doc of documents) {
    if (doc.filename && !(await deleteCvFile(platform, db, doc.filename, true)))
      cleanupFailed = true;
  }
  for (const version of identityVersions) {
    try {
      await removeAssets(platform, version.id);
      const {error: deleteError} = await db
        .from('db_identity_versions')
        .delete()
        .eq('id', version.id);
      if (deleteError) cleanupFailed = true;
    } catch (error) {
      cleanupFailed = true;
      console.error('Identity asset cleanup failed:', error);
    }
  }
  try {
    const {cleanupPending} = await cleanupBlogAssets(db, platform);
    if (cleanupPending) cleanupFailed = true;
  } catch (error) {
    cleanupFailed = true;
    console.error('Blog asset cleanup failed:', error);
  }

  await logActivity(
    {
      actor: actorEmail,
      action: 'data.delete_all',
      category: 'security',
      summary:
        cleanupFailed ?
          'Deleted all site data; some uploaded files need retry.'
        : 'Deleted all site data.',
      ip: (() => {
        try {
          return getClientAddress();
        } catch {
          return null;
        }
      })(),
      ipSalt:
        (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
        ?? privateEnv.IP_SALT
        ?? '',
      userAgent: request.headers.get('user-agent') ?? undefined
    },
    db
  );

  if (cleanupFailed)
    return apiError(
      503,
      'DATA_DELETE_CLEANUP_FAILED',
      'Site data was cleared, but some uploaded files remain. Try again to finish deleting them.'
    );

  return json({success: true}, {headers: {'Cache-Control': 'no-store'}});
};
