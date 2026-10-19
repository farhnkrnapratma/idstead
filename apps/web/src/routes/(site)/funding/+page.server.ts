import { supabase } from '#lib/supabase.ts';
import { fetchFundingLinks } from '#lib/author.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ funding: await fetchFundingLinks(supabase) });
