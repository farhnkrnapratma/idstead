import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { createSupabaseAdminAuthorStore } from '@idstead/data';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'AUTHOR_UNAVAILABLE', 'Database is unavailable.');
    const part = url.searchParams.get('part') ?? 'all';
    if (part !== 'all' && part !== 'profile')
        return apiError(400, 'AUTHOR_INVALID_PART', 'part must be all or profile.');
    const store = createSupabaseAdminAuthorStore(db);
    try {
        const body =
            part === 'profile' ? { profile: await store.profile() } : await store.snapshot();
        return json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin author load failed:', error);
        return apiError(503, 'AUTHOR_UNAVAILABLE', 'Author data could not be loaded.');
    }
};
