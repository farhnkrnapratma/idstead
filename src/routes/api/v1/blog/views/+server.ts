import {supabase} from '$lib/supabase';
import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({url}) => {
  const postId = url.searchParams.get('postId')?.trim() || '';
  if (!postId) {
    return apiError(400, 'BLOG_VIEW_POST_ID_REQUIRED', 'postId is required.');
  }

  if (!UUID_RE.test(postId)) {
    return apiError(
      400,
      'BLOG_VIEW_INVALID_POST_ID',
      'postId must be a valid UUID.'
    );
  }

  const {count} = await supabase
    .from('db_views')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', postId);

  return json(
    {postId, views: count ?? 0},
    {headers: {'Cache-Control': 'public, max-age=3600, s-maxage=86400'}}
  );
};
