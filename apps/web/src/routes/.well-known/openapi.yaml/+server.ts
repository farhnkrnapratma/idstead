// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { apiBaseUrl } from '#lib/apiConfig.ts';
import { openapiSpec } from '#lib/openapi.ts';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { stringify } from 'yaml';

export const GET: RequestHandler = async ({ request }) => {
    const spec = { ...openapiSpec, servers: [{ url: apiBaseUrl(publicEnv.PUBLIC_API_BASE_URL) }] };
    const response = await publicResponse(
        request,
        stringify(spec),
        'application/yaml; charset=utf-8'
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
