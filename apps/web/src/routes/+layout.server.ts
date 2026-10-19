import type { LayoutServerLoad } from './$types';
import { supabase } from '#lib/supabase.ts';
import { fetchAuthorProfileWithSocials, fetchProjectRepoRules } from '#lib/author.ts';
import { avatarSource } from '#lib/siteIdentity.ts';
import { extractGitHubUsername } from '#lib/server/githubProjects.ts';
import { fetchCachedProjects, withoutExcludedProjects } from '#lib/server/projectsCache.ts';

export const load: LayoutServerLoad = async ({ fetch, platform, setHeaders }) => {
    const author = await fetchAuthorProfileWithSocials(supabase);

    const githubUsername = extractGitHubUsername(author);
    const [projects, repoRules] = await Promise.all([
        githubUsername ? fetchCachedProjects(githubUsername, fetch, platform) : [],
        fetchProjectRepoRules(supabase)
    ]);

    try {
        setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60, must-revalidate' });
    } catch {}
    return {
        author: author ? { ...author, avatar: avatarSource(author) } : author,
        projects: withoutExcludedProjects(projects, repoRules.excluded),
        pinnedRepoNames: repoRules.pinned
    };
};
