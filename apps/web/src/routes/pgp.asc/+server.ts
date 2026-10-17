import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '#lib/supabase.ts';
import { fetchActiveOpenPgpKey } from '#lib/author.ts';
import { publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request }) => {
    const key = await fetchActiveOpenPgpKey(supabase);
    if (!key) error(404, 'No OpenPGP key is published.');
    const response = await publicResponse(request, key.armored, 'text/plain; charset=utf-8', 300);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Content-Disposition', 'inline; filename="pgp.asc"');
    return response;
};
