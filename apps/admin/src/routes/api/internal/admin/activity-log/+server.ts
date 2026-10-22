import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { apiError } from '#lib/server/apiError.ts';
import { activityLogQuery } from '#lib/server/activityLogQuery.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    const service = dataStores(platform).service;
    if (!db || !service)
        return apiError(
            503,
            'ACTIVITY_LOG_UNAVAILABLE',
            'Activity log is temporarily unavailable.'
        );
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'ACTIVITY_LOG_AUTH_REQUIRED', auth.message);

    let query;
    try {
        query = activityLogQuery(url.searchParams);
    } catch (error) {
        return apiError(
            400,
            'ACTIVITY_LOG_INVALID_QUERY',
            error instanceof Error ? error.message : 'Invalid query.'
        );
    }
    let page;
    try {
        page = await service.activityLog.list(query);
    } catch {
        return apiError(503, 'ACTIVITY_LOG_FETCH_FAILED', 'Could not load activity log.');
    }

    return Response.json(
        { data: page.data, total: page.total, limit: query.limit, offset: query.offset },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
