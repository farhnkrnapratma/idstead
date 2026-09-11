import {json} from '@sveltejs/kit';
import {apiError} from '$lib/server/apiError';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {fetchCvEntries} from '$lib/author';
import {sanitizePublicApiData} from '$lib/authorApi';

export const GET: RequestHandler = async ({locals}) => {
  const supabaseClient = (locals as any)?.supabase || supabase;
  let rawCv;
  try {
    rawCv = await fetchCvEntries(supabaseClient, {strict: true});
  } catch {
    return apiError(
      500,
      'AUTHOR_CV_FETCH_FAILED',
      'Could not fetch author cv.'
    );
  }
  const cv = sanitizePublicApiData(rawCv);
  return json(cv, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
      'X-Robots-Tag': 'index, follow'
    }
  });
};
