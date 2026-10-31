// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { readSite, publicResponse } from '#lib/server/publicMetadata.ts';
import { themeColors } from '@idstead/ui/themeColors.ts';

export const GET: RequestHandler = async ({ request, platform }) => {
    const { profile } = await readSite(platform);
    if (!profile) error(404, 'The site has no profile yet.');
    const manifest = {
        id: '/',
        name: profile.name,
        short_name: profile.username.replace(/^@+/, ''),
        description: profile.bio,
        start_url: '/',
        scope: '/',
        ...profile.manifest_settings,
        display: 'standalone',
        ...themeColors(),
        icons: [192, 512].map(size => ({
            src: `/android-chrome-${size}x${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any'
        }))
    };
    return publicResponse(
        request,
        JSON.stringify(manifest),
        'application/manifest+json; charset=utf-8'
    );
};
