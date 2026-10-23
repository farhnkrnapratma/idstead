import type { RequestHandler } from './$types';
import {
    ArdRequestError,
    ardErrorResponse,
    listArdEntries,
    parseArdListRequest
} from '#lib/server/ard.ts';
import {
    ArdIndexUnavailableError,
    ardIndexUnavailableResponse,
    getArdIndexEntries
} from '#lib/server/ardIndexServer.ts';
import { readSite, publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    try {
        const listRequest = parseArdListRequest(url);
        const { siteUrl } = await readSite(platform);
        const entries = await getArdIndexEntries(siteUrl, platform);
        const response = await publicResponse(
            request,
            JSON.stringify(listArdEntries(listRequest, siteUrl, entries)),
            'application/json; charset=utf-8'
        );
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
    } catch (error) {
        if (error instanceof ArdIndexUnavailableError) return ardIndexUnavailableResponse();
        if (!(error instanceof ArdRequestError)) throw error;
        return ardErrorResponse(error);
    }
};
