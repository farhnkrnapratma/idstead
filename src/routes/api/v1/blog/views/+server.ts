import {supabase} from '$lib/supabase';
import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';

export const GET: RequestHandler = async ({url}) => {
  const postId = url.searchParams.get('postId')?.trim() || '';
  if (!postId) {
    return apiError(400, 'BLOG_VIEW_POST_ID_REQUIRED', 'postId is required.');
  }

  const {count} = await supabase
    .from('db_views')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', postId);

  return json({postId, views: count ?? 0});
};
