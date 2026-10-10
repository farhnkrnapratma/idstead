import { json } from '@sveltejs/kit';
import { apiError } from '#lib/server/apiError.ts';
import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { fetchFundingLinks } from '#lib/author.ts';
import { sanitizePublicApiData } from '#lib/authorApi.ts';

export const GET: RequestHandler = async ({ locals }) => {
    const supabaseClient = (locals as any)?.supabase || supabase;
    let rawFunding;
    try {
        rawFunding = await fetchFundingLinks(supabaseClient, { strict: true });
    } catch {
        return apiError(500, 'AUTHOR_FUNDING_FETCH_FAILED', 'Could not fetch author funding.');
    }
    const funding = sanitizePublicApiData(rawFunding);
    return json(funding, {
        headers: {
            'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
            'X-Robots-Tag': 'index, follow'
        }
    });
};
