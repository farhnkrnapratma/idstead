// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { error } from '@sveltejs/kit';
import * as publicEnv from '$app/env/public';
import type { RequestHandler } from './$types';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { skillDocument } from '#lib/server/apiDiscovery.ts';

export const GET: RequestHandler = async ({ params, request }) => {
    const body = skillDocument(params.name, publicEnv.PUBLIC_API_BASE_URL);
    if (!body) error(404, 'Skill document not found.');
    const response = await publicResponse(request, body, 'text/markdown; charset=utf-8');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
