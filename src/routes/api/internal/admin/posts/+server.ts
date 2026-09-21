import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {apiError} from '$lib/server/apiError';
import {blogAdmin} from '$lib/server/blogPostAuth';
import {parsePostInput} from '$lib/server/blogPostInput';
import {savePostOperation, type PostOperation} from '$lib/server/blogPostSave';
import {cleanupBlogAssets, putBanner} from '$lib/server/blogBannerStorage';
import {UUID_PATTERN} from '$lib/blogBanner';
import {extractPostConfig} from '$lib/markdown';
import {createApiRegistry, validateDefineForSave} from '$lib/define';
import {notifyNewPost} from '$lib/server/subscriberBroadcast';

export const POST: RequestHandler = async ({request, url, platform}) => {
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'BLOG_SAVE_UNAVAILABLE',
      'Post storage is not configured.'
    );
  const auth = await blogAdmin(request, url, db);
  if (auth.status)
    return apiError(auth.status, 'BLOG_SAVE_AUTH_REQUIRED', auth.message);
  let input;
  try {
    const {default: bannerWasm} = await import('virtual:banner-webp-wasm');
    input = await parsePostInput(request, bannerWasm());
  } catch (error) {
    return apiError(
      400,
      'BLOG_SAVE_INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid post data.'
    );
  }
  try {
    if (input.kind === 'save') {
      const validation = await validateDefineForSave(
        extractPostConfig(input.markdown).body,
        createApiRegistry(db)
      );
      if (!validation.ok)
        return apiError(
          422,
          'BLOG_DEFINE_VALIDATION_FAILED',
          validation.errors.map(error => error.message).join(' | ')
        );
    }
    const operation = await savePostOperation(db, auth.actor, input, () =>
      putBanner(platform, input.id, input.operationId, input.image!)
    );
    if (operation.state === 'conflict')
      return apiError(
        409,
        'BLOG_REVISION_CONFLICT',
        'This post changed in another session. Reload before saving.'
      );
    if (operation.state === 'rejected')
      return apiError(
        422,
        'BLOG_SAVE_REJECTED',
        'Post fields could not be committed. Check that the slug is unique.'
      );
    if (operation.result?.published && operation.result.id) {
      const broadcast = notifyNewPost(
        db,
        platform,
        url.origin,
        operation.result.id
      ).catch(error => {
        console.error('Subscriber broadcast failed:', error);
      });
      const waitUntil = (
        platform as {context?: {waitUntil?: (p: Promise<unknown>) => void}}
      )?.context?.waitUntil;
      if (waitUntil) waitUntil(broadcast);
      else await broadcast;
    }
    let cleanupPending = false;
    try {
      ({cleanupPending} = await cleanupBlogAssets(db, platform));
    } catch {
      cleanupPending = true;
    }
    return json(
      {
        success: true,
        operationId: operation.id,
        post: operation.result,
        cleanupPending
      },
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    if ((error as {code?: string})?.code === '22023')
      return apiError(
        409,
        'BLOG_OPERATION_REUSED',
        'This operation ID was used for different post data.'
      );
    return apiError(
      503,
      'BLOG_SAVE_UNCONFIRMED',
      'Save is not confirmed. Check its status or retry the same operation.',
      input.operationId
    );
  }
};

export const GET: RequestHandler = async ({request, url, platform}) => {
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'BLOG_SAVE_UNAVAILABLE',
      'Post storage is not configured.'
    );
  const auth = await blogAdmin(request, url, db);
  if (auth.status)
    return apiError(auth.status, 'BLOG_SAVE_AUTH_REQUIRED', auth.message);
  const id = url.searchParams.get('operationId') || '';
  if (!UUID_PATTERN.test(id))
    return apiError(
      400,
      'BLOG_OPERATION_INVALID',
      'A valid operation ID is required.'
    );
  const {data, error} = await db
    .from('db_post_operations')
    .select('id, state, result')
    .eq('id', id)
    .eq('actor_id', auth.actor)
    .maybeSingle();
  if (error)
    return apiError(
      503,
      'BLOG_RECONCILIATION_UNAVAILABLE',
      'Save status could not be checked. Retry shortly.'
    );
  if (!data)
    return json({state: 'unknown'}, {headers: {'Cache-Control': 'no-store'}});
  const operation = data as PostOperation;
  return json(
    {operationId: operation.id, state: operation.state, post: operation.result},
    {headers: {'Cache-Control': 'no-store'}}
  );
};
