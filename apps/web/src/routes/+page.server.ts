import { supabase } from '#lib/supabase.ts';
import type { PageServerLoad } from './$types';
import { avatarSource } from '#lib/siteIdentity.ts';
import { withoutExcludedProjects } from '#lib/server/projectsCache.ts';
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

export const load: PageServerLoad = async ({ fetch, parent }) => {
    const supabaseClient = supabase;
    const layoutData = parent();
    const postsPromise = loadPublishedPosts(fetch, { limit: HOME_POST_LIMIT });

    const [author, cv, funding, contact, skillsGrouped, cvDocument, repoRules] = await Promise.all([
        fetchAuthorProfileWithSocials(supabaseClient, { includeEmail: true }),
        fetchCvEntries(supabaseClient),
        fetchFundingLinks(supabaseClient),
        fetchContactInfo(supabaseClient),
        fetchGroupedSkills(supabaseClient),
        fetchActiveCvDocument(supabaseClient, fetch),
        fetchProjectRepoRules(supabaseClient)
    ]);

    const [{ projects: layoutProjects }, dbPosts] = await Promise.all([layoutData, postsPromise]);
    const projects = withoutExcludedProjects(layoutProjects, repoRules.excluded);

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
