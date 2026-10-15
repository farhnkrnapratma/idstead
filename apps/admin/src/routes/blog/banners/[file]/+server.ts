import type { RequestHandler } from './$types';
import { serveBlogBanner } from '#lib/server/blogBannerResponse.ts';

export const GET: RequestHandler = ({ request, params, platform }) =>
    serveBlogBanner(request, params.file, platform);

export const HEAD = GET;
