import { supabase } from '#lib/supabase.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { apiError } from '#lib/server/apiError.ts';
import { escapePostgrestFilter } from '#lib/server/postgrestSanitize.ts';

export interface SearchResult {
    type: 'post' | 'project';
    title: string;
    subtitle: string;
    url: string;
    tags?: string[];
}

export const GET: RequestHandler = async ({ url }) => {
    const q = url.searchParams.get('q')?.trim() ?? '';
    const limitParam = parseInt(url.searchParams.get('limit') || '6', 10);
    const limit = Math.min(Math.max(1, Number.isNaN(limitParam) ? 6 : limitParam), 20);
    const offsetParam = url.searchParams.get('offset');
    if (offsetParam !== null && !/^\d+$/.test(offsetParam))
        return apiError(400, 'SEARCH_INVALID_OFFSET', '`offset` must be a non-negative integer.');
    const offset = offsetParam === null ? 0 : Number(offsetParam);

    if (q.length < 2) {
        return json(
            { query: q, data: [], pagination: { limit, offset, returned: 0, hasMore: false } },
            { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate' } }
        );
    }

    const results: SearchResult[] = [];
    const normalizedQuery = escapePostgrestFilter(q);

    const { data: posts, error: postsError } = await supabase
        .from('db_posts')
        .select('id, title, slug, excerpt')
        .eq('published', true)
        .or(`title.ilike.%${normalizedQuery}%,excerpt.ilike.%${normalizedQuery}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit);

    if (postsError)
        return apiError(500, 'SEARCH_FETCH_FAILED', 'Could not search published posts.');

    const hasMore = (posts?.length ?? 0) > limit;

    if (posts) {
        for (const post of posts.slice(0, limit)) {
            results.push({
                type: 'post',
                title: post.title,
                subtitle: post.excerpt ?? 'Blog post',
                url: `/blog/${post.slug}`
            });
        }
    }

    return json(
        {
            query: q,
            data: results,
            pagination: { limit, offset, returned: results.length, hasMore }
        },
        { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate' } }
    );
};
