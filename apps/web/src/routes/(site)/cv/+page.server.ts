import { supabase } from '#lib/supabase.ts';
import { fetchCvEntries, fetchGroupedSkills } from '#lib/author.ts';
import { loadPublicCvDocument } from '#lib/server/publicCvDocument.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    const [cv, skills, cvDocument] = await Promise.all([
        fetchCvEntries(supabase),
        fetchGroupedSkills(supabase),
        loadPublicCvDocument(fetch)
    ]);
    return { cv, skills, cvDocument };
};
