import type { LayoutServerLoad } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';
import { avatarSource } from '#lib/siteIdentity.ts';
import { fetchCachedProjects, withoutExcludedProjects } from '#lib/server/projectsCache.ts';
import { publishedLegalSlugs } from '@idstead/domain/legal.ts';
import { resendApiKey, senderAddress } from '#lib/server/subscribers.ts';

export const load: LayoutServerLoad = async ({ fetch, platform, setHeaders }) => {
    const { author: authorRepository, legal } = publicRepositories(fetch);
    const [profile, socialLinks, legalPages] = await Promise.all([
        authorRepository.profile().catch(() => null),
        authorRepository.socialLinks().catch(() => []),
        legal
            .pages()
            .then(publishedLegalSlugs)
            .catch(() => [])
    ]);
    const author = profile ? { ...profile, socialLinks } : null;

    const [projects, repoRules] = await Promise.all([
        fetchCachedProjects(fetch, platform),
        authorRepository.projectRepoRules().catch(() => ({ excluded: [], pinned: [] }))
    ]);

    try {
        setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60, must-revalidate' });
    } catch {}
    return {
        author: author ? { ...author, avatar: avatarSource(author) } : author,
        projects: withoutExcludedProjects(projects, repoRules.excluded),
        pinnedRepoNames: repoRules.pinned,
        legalPages,
        newsletterEnabled: Boolean(resendApiKey(platform) && senderAddress(platform))
    };
};
