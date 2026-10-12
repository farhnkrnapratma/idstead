import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { apiBaseUrl } from '#lib/apiConfig.ts';
import { openapiSpec } from '#lib/openapi.ts';
import { publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request }) => {
    const spec = { ...openapiSpec, servers: [{ url: apiBaseUrl(publicEnv.PUBLIC_API_BASE_URL) }] };
    const response = await publicResponse(
        request,
        JSON.stringify(spec, null, 2),
        'application/json; charset=utf-8'
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
