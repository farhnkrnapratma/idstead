import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '#lib/supabase.ts';
import { fetchActiveOpenPgpKey } from '#lib/author.ts';
import { readSiteProfile } from '#lib/server/publicMetadata.ts';
import { wkdKey } from '#lib/server/wkd.ts';

export const GET: RequestHandler = async ({ params }) => {
    const [key, profile] = await Promise.all([fetchActiveOpenPgpKey(supabase), readSiteProfile()]);
    const body = await wkdKey(params.hash, key, profile.siteUrl);
    if (!body) error(404, 'Not found.');
    return new Response(body, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        }
    });
};
