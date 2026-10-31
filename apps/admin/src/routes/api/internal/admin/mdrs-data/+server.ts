import type { RequestHandler } from './$types';
import type { MdrsDataLoaders } from '#lib/mdrsResolvers.ts';
import { requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import { DefineError } from '@mdrs/core';
import { isValidPostSlug } from '@idstead/domain/slug.ts';
import { apiError } from '#lib/server/apiError.ts';
import { dataStores } from '#lib/server/data.ts';
import { mdrsLoaders } from '#lib/server/mdrsData.ts';

const SCOPES = {
    author: loaders => loaders.author(),
    blog: loaders => loaders.blogList(),
    analytics: loaders => loaders.analytics(),
    post: (loaders, slug) => loaders.blogPost(slug)
} satisfies Record<string, (loaders: MdrsDataLoaders, slug: string) => Promise<unknown>>;

function isScope(value: unknown): value is keyof typeof SCOPES {
    return typeof value === 'string' && Object.hasOwn(SCOPES, value);
}

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as {
        scope?: unknown;
        slug?: unknown;
    } | null;
    const scope = body?.scope;
    const slug = typeof body?.slug === 'string' ? body.slug : '';
    if (!isScope(scope))
        return apiError(
            400,
            'MDRS_DATA_SCOPE_INVALID',
            "Scope must be 'author', 'blog', 'post' or 'analytics'."
        );
    if (scope === 'post' && !isValidPostSlug(slug))
        return apiError(400, 'MDRS_DATA_SLUG_INVALID', 'A valid post slug is required.');

    const service = dataStores(platform).service;
    if (!service)
        return apiError(503, 'MDRS_DATA_UNAVAILABLE', 'Live data is unavailable right now.');
    const loaders = mdrsLoaders(service);
    try {
        const data = await SCOPES[scope](loaders, slug);
        return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof DefineError)
            return apiError(404, 'MDRS_DATA_NOT_FOUND', error.message);
        console.error('MDRS live data failed:', error);
        return apiError(503, 'MDRS_DATA_UNAVAILABLE', 'Live data is unavailable right now.');
    }
};
