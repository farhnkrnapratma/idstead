// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';
import { serveIdentityAsset } from '#lib/server/profileAssets.ts';
import { avatarFileFor, emailHashMatches, requestedAvatarSize } from '#lib/server/avatarLookup.ts';
import { publishedEmail } from '#lib/server/publishedEmail.ts';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function notFound() {
    return new Response(null, {
        status: 404,
        headers: { ...CORS, 'Cache-Control': 'public, max-age=300' }
    });
}

export const GET: RequestHandler = async ({ request, params, url, platform }) => {
    const { author } = publicRepositories();
    let profile: Awaited<ReturnType<typeof author.profile>>;
    let contact: Awaited<ReturnType<typeof author.contactLinks>>;
    try {
        [profile, contact] = await Promise.all([
            author.profile({ includeEmail: true }),
            author.contactLinks()
        ]);
    } catch {
        return new Response(null, {
            status: 503,
            headers: { ...CORS, 'Cache-Control': 'no-store' }
        });
    }
    if (
        !profile?.avatarVersion
        || !emailHashMatches(params.hash, publishedEmail(profile.email, contact))
    )
        return notFound();

    const file = avatarFileFor(requestedAvatarSize(url.searchParams));
    const asset = await serveIdentityAsset(request, new URL(`/${file}`, url), platform);
    if (!asset.ok) return notFound();
    const headers = new Headers(asset.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(asset.body, { status: asset.status, headers });
};
