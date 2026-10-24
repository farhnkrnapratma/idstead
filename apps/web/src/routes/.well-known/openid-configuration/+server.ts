import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { oidcSigningKey } from '#lib/server/oidc/keys.ts';
import { discoveryDocument, oidcEndpoints } from '#lib/server/oidc/config.ts';

export const GET: RequestHandler = async ({ request, platform }) => {
    if (!(await oidcSigningKey(platform))) error(404, 'Not Found');
    const response = await publicResponse(
        request,
        JSON.stringify(discoveryDocument(oidcEndpoints(platform))),
        'application/json',
        300
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
