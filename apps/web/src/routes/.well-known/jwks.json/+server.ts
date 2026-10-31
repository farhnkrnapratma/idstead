// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { oidcSigningKey } from '#lib/server/oidc/keys.ts';

export const GET: RequestHandler = async ({ request, platform }) => {
    const key = await oidcSigningKey(platform);
    if (!key) error(404, 'Not Found');
    const response = await publicResponse(
        request,
        JSON.stringify({ keys: [key.publicJwk] }),
        'application/jwk-set+json',
        300
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
