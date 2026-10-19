import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { publicRepositories } from '#lib/server/repositories.ts';

export const GET: RequestHandler = async ({ request, fetch }) => {
    const key = await publicRepositories(fetch)
        .author.activeOpenPgpKey()
        .catch(() => null);
    if (!key) error(404, 'No OpenPGP key is published.');
    const response = await publicResponse(request, key.armored, 'text/plain; charset=utf-8', 300);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Content-Disposition', 'inline; filename="pgp.asc"');
    return response;
};
