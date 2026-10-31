// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import {
    ArdRequestError,
    ardErrorResponse,
    exploreArdEntriesWithAI,
    readArdRequestJson,
    resolveArdAiBinding,
    validateArdExploreRequest
} from '#lib/server/ard.ts';
import {
    ArdIndexUnavailableError,
    ardIndexUnavailableResponse,
    getArdIndexEntries
} from '#lib/server/ardIndexServer.ts';
import { readSite } from '#lib/server/publicMetadata.ts';

export const POST: RequestHandler = async ({ request, platform, fetch }) => {
    try {
        const body = await readArdRequestJson(request);
        const exploreRequest = validateArdExploreRequest(body);
        const { siteUrl } = await readSite(platform);
        const entries = await getArdIndexEntries(siteUrl, platform, fetch);
        const ai = await resolveArdAiBinding(platform?.env?.AI);
        return new Response(
            JSON.stringify(await exploreArdEntriesWithAI(exploreRequest, siteUrl, ai, entries)),
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
