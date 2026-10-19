import type { LayoutServerLoad } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';
import { avatarSource } from '#lib/siteIdentity.ts';
import { extractGitHubUsername } from '#lib/server/githubProjects.ts';
import { fetchCachedProjects, withoutExcludedProjects } from '#lib/server/projectsCache.ts';

export const load: LayoutServerLoad = async ({ fetch, platform, setHeaders }) => {
    const { author: authorRepository } = publicRepositories(fetch);
    const [profile, socialLinks] = await Promise.all([
        authorRepository.profile().catch(() => null),
        authorRepository.socialLinks().catch(() => [])
    ]);
    const author = profile ? { ...profile, socialLinks } : null;

    const githubUsername = extractGitHubUsername(author);
    const [projects, repoRules] = await Promise.all([
        githubUsername ? fetchCachedProjects(githubUsername, fetch, platform) : [],
        authorRepository.projectRepoRules().catch(() => ({ excluded: [], pinned: [] }))
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
