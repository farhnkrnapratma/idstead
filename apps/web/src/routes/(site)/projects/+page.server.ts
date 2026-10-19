import { supabase } from '#lib/supabase.ts';
import { fetchProjectRepoRules } from '#lib/author.ts';
import { withoutExcludedProjects } from '#lib/server/projectsCache.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
    const [{ projects }, repoRules] = await Promise.all([
        parent(),
        fetchProjectRepoRules(supabase)
    ]);
    return {
        projects: withoutExcludedProjects(projects, repoRules.excluded),
        pinnedRepoNames: repoRules.pinned
    };
};
