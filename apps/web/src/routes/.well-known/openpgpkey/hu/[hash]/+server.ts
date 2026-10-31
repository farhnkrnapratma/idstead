// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { publicRepositories } from '#lib/server/repositories.ts';
import { readSite } from '#lib/server/publicMetadata.ts';
import { wkdKey } from '#lib/server/wkd.ts';

export const GET: RequestHandler = async ({ params, fetch, platform }) => {
    const [key, { siteUrl }] = await Promise.all([
        publicRepositories(fetch)
            .author.activeOpenPgpKey()
            .catch(() => null),
        readSite(platform)
    ]);
    const body = await wkdKey(params.hash, key, siteUrl);
    if (!body) error(404, 'Not found.');
    return new Response(body, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        }
    });
};
