import {json} from '@sveltejs/kit';
import {apiError} from '#lib/server/apiError.ts';
import type {RequestHandler} from './$types';
import {supabase} from '#lib/supabase.ts';
import {fetchSocials} from '#lib/author.ts';
import {sanitizePublicApiData} from '#lib/authorApi.ts';

export const GET: RequestHandler = async ({locals}) => {
  const supabaseClient = (locals as any)?.supabase || supabase;
  let rawSocials;
  try {
    rawSocials = await fetchSocials(supabaseClient, {strict: true});
  } catch {
    return apiError(
      500,
      'AUTHOR_SOCIALS_FETCH_FAILED',
      'Could not fetch author socials.'
    );
  }
  const socials = sanitizePublicApiData(rawSocials);
  return json(socials, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
      'X-Robots-Tag': 'index, follow'
    }
  });
};
