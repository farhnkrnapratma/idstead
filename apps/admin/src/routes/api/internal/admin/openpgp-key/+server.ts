import type { RequestHandler } from './$types';
import { processOpenPgpKey } from '#lib/server/adminCv.ts';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';

const handle: RequestHandler = async ({ request, platform, url, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
    return processOpenPgpKey(request, platform, getClientAddress);
};

export const POST = handle;
export const DELETE = handle;
