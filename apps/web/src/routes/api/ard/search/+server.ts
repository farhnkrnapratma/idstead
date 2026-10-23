import type { RequestHandler } from './$types';
import {
    ArdRequestError,
    ardErrorResponse,
    readArdRequestJson,
    resolveArdAiBinding,
    searchArdEntriesWithAI,
    validateArdSearchRequest
} from '#lib/server/ard.ts';
import {
    ArdIndexUnavailableError,
    ardIndexUnavailableResponse,
    getArdIndexEntries
} from '#lib/server/ardIndexServer.ts';
import { readSite } from '#lib/server/publicMetadata.ts';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await readArdRequestJson(request);
        const searchRequest = validateArdSearchRequest(body);
        const { siteUrl } = await readSite(platform);
        const entries = await getArdIndexEntries(siteUrl, platform);
        const ai = await resolveArdAiBinding(platform?.env?.AI);
        return new Response(
            JSON.stringify(await searchArdEntriesWithAI(searchRequest, siteUrl, ai, entries)),
            {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store'
                }
            }
        );
    } catch (error) {
        if (error instanceof ArdIndexUnavailableError) return ardIndexUnavailableResponse();
        if (!(error instanceof ArdRequestError)) throw error;
        return ardErrorResponse(error);
    }
};
