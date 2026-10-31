// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { readSite, publicResponse } from '#lib/server/publicMetadata.ts';
import { discoveryOperations, skillDocument, contentDigest } from '#lib/server/apiDiscovery.ts';

export const GET: RequestHandler = async ({ request, platform }) => {
    const { siteUrl } = await readSite(platform);
    const skills = await Promise.all(
        discoveryOperations(publicEnv.PUBLIC_API_BASE_URL).map(async operation => ({
            name: operation.name,
            type: 'skill-md',
            description: operation.description,
            url: `${siteUrl}/.well-known/agent-skills/${operation.name}/SKILL.md`,
            digest: await contentDigest(
                skillDocument(operation.name, publicEnv.PUBLIC_API_BASE_URL)!
            )
        }))
    );
    const response = await publicResponse(
        request,
        JSON.stringify({ skills }, null, 2),
        'application/json; charset=utf-8'
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
