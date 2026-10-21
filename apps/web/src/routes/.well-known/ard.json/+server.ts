import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { createArdManifest } from '#lib/server/ard.ts';
import { discoveryOperations } from '#lib/server/apiDiscovery.ts';
import { readSiteProfile, publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request }) => {
    const profile = await readSiteProfile();
    const response = await publicResponse(
        request,
        JSON.stringify(
            createArdManifest(profile.siteUrl, discoveryOperations(publicEnv.PUBLIC_API_BASE_URL)),
            null,
            2
        ),
        'application/json; charset=utf-8'
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
