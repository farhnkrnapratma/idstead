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
import { readSiteProfile } from '#lib/server/publicMetadata.ts';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await readArdRequestJson(request);
        const searchRequest = validateArdSearchRequest(body);
        const profile = await readSiteProfile();
        const entries = await getArdIndexEntries(profile.siteUrl, platform);
        const ai = await resolveArdAiBinding(platform?.env?.AI);
        return new Response(
            JSON.stringify(
                await searchArdEntriesWithAI(searchRequest, profile.siteUrl, ai, entries)
            ),
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
