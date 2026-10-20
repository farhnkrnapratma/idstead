import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DefineError } from '@mdrs/core';
import { isValidPostSlug } from '@idstead/domain/slug.ts';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { supabaseMdrsLoaders } from '#lib/server/mdrsData.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );

    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as {
        scope?: unknown;
        slug?: unknown;
    } | null;
    const scope = body?.scope;
    const slug = typeof body?.slug === 'string' ? body.slug : '';
    if (scope !== 'author' && scope !== 'blog' && scope !== 'post')
        return apiError(
            400,
            'MDRS_DATA_SCOPE_INVALID',
            "Scope must be 'author', 'blog' or 'post'."
        );
    if (scope === 'post' && !isValidPostSlug(slug))
        return apiError(400, 'MDRS_DATA_SLUG_INVALID', 'A valid post slug is required.');

    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'MDRS_DATA_UNAVAILABLE', 'Live data is unavailable right now.');
    const loaders = supabaseMdrsLoaders(db);
    try {
        const data =
            scope === 'author' ? await loaders.author()
            : scope === 'blog' ? await loaders.blogList()
            : await loaders.blogPost(slug);
        return json({ data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof DefineError)
            return apiError(404, 'MDRS_DATA_NOT_FOUND', error.message);
        console.error('MDRS live data failed:', error);
        return apiError(503, 'MDRS_DATA_UNAVAILABLE', 'Live data is unavailable right now.');
    }
};
