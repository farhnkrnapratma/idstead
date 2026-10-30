import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { dataStores } from '#lib/server/data.ts';
import { requireAdminAuth } from '#lib/server/adminResume.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;
    const service = dataStores(platform).service;
    if (!service) return apiError(503, 'AUTHOR_UNAVAILABLE', 'Database is unavailable.');
    const part = url.searchParams.get('part') ?? 'all';
    if (part !== 'all' && part !== 'profile')
        return apiError(400, 'AUTHOR_INVALID_PART', 'part must be all or profile.');
    const store = service.adminAuthor;
    try {
        const body =
            part === 'profile' ? { profile: await store.profile() } : await store.snapshot();
        return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin author load failed:', error);
        return apiError(503, 'AUTHOR_UNAVAILABLE', 'Author data could not be loaded.');
    }
};
