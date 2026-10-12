import { supabase } from '#lib/supabase.ts';
import type { PageServerLoad } from './$types';
import { avatarSource } from '#lib/siteIdentity.ts';
import type { Project } from '#lib/types.ts';
import { fetchProjects, extractGitHubUsername } from '#lib/server/githubProjects.ts';
import { loadPublishedPosts } from '#lib/server/blogPosts.ts';
import {
    fetchAuthorProfileWithSocials,
    fetchCvEntries,
    fetchFundingLinks,
    fetchContactInfo,
    fetchGroupedSkills,
    fetchActiveCvDocument,
    fetchProjectRepoRules
} from '#lib/author.ts';

export type { BlogPost } from '#lib/server/blogPosts.ts';

const HOME_POST_LIMIT = 5;

export const load: PageServerLoad = async ({ fetch, platform, locals }) => {
    const supabaseClient = (locals as any)?.supabase || supabase;

    const [author, cv, funding, contact, skillsGrouped, cvDocument, repoRules] = await Promise.all([
        fetchAuthorProfileWithSocials(supabaseClient, { includeEmail: true }),
        fetchCvEntries(supabaseClient),
        fetchFundingLinks(supabaseClient),
        fetchContactInfo(supabaseClient),
        fetchGroupedSkills(supabaseClient),
        fetchActiveCvDocument(supabaseClient, fetch),
        fetchProjectRepoRules(supabaseClient)
    ]);

    const githubUsername = extractGitHubUsername(author);
    const projectsPromise =
        githubUsername ?
            fetchProjects(githubUsername, fetch, platform, repoRules.excluded)
        :   Promise.resolve<Project[]>([]);
    const postsPromise = loadPublishedPosts(fetch, { limit: HOME_POST_LIMIT });
    const [projects, dbPosts] = await Promise.all([projectsPromise, postsPromise]);

    return {
        projects,
        pinnedRepoNames: repoRules.pinned,
        posts: dbPosts,
        author: author ? { ...author, avatar: avatarSource(author) } : author,
        cv,
        funding,
        contact,
        skills: skillsGrouped,
        cvExists: Boolean(cvDocument?.fileUrl)
    };
};
