import type { RequestHandler } from './$types';
import { readSiteProfile, publicResponse } from '#lib/server/publicMetadata.ts';
import { themeColors } from '#lib/themeColors.ts';

export const GET: RequestHandler = async ({ request, url }) => {
    const profile = await readSiteProfile();
    const manifest = {
        id: '/',
        name: profile.name,
        short_name: profile.username.replace(/^@+/, ''),
        description: profile.bio,
        start_url: '/',
        scope: '/',
        ...profile.manifest_settings,
        display: 'standalone',
        ...themeColors(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'),
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
