import type {LayoutServerLoad} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfileWithSocials} from '$lib/author';

export const load: LayoutServerLoad = async ({setHeaders}) => {
  const author = await fetchAuthorProfileWithSocials(supabase);
  try {
    setHeaders({'cache-control': 'public, max-age=3600, s-maxage=86400'});
  } catch {}
  return {author};
};
