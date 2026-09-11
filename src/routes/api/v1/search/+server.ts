import {supabase} from '$lib/supabase';
import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';

import {apiError} from '$lib/server/apiError';
import {escapePostgrestFilter} from '$lib/server/postgrestSanitize';

export interface SearchResult {
  type: 'post' | 'project';
  title: string;
  subtitle: string;
  url: string;
  tags?: string[];
}

export const GET: RequestHandler = async ({url}) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limitParam = parseInt(url.searchParams.get('limit') || '6', 10);
  const limit = Math.min(
    Math.max(1, Number.isNaN(limitParam) ? 6 : limitParam),
    20
  );

  if (q.length < 2) {
    return json(
      {query: q, data: [], pagination: {limit, returned: 0}},
      {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate'
        }
      }
    );
  }

  const results: SearchResult[] = [];
  const normalizedQuery = escapePostgrestFilter(q);

  const {data: posts, error: postsError} = await supabase
    .from('db_posts')
    .select('id, title, slug, excerpt')
    .eq('published', true)
    .or(`title.ilike.%${normalizedQuery}%,excerpt.ilike.%${normalizedQuery}%`)
    .order('created_at', {ascending: false})
    .limit(limit);

  if (postsError)
    return apiError(
      500,
      'SEARCH_FETCH_FAILED',
      'Could not search published posts.'
    );

  if (posts) {
    for (const post of posts) {
      results.push({
        type: 'post',
        title: post.title,
        subtitle: post.excerpt ?? 'Blog post',
        url: `/blog/${post.slug}`
      });
    }
  }

  return json(
    {query: q, data: results, pagination: {limit, returned: results.length}},
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate'
      }
    }
  );
};
