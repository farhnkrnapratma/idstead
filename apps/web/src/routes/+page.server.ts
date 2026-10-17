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
    fetchActiveOpenPgpKey,
    fetchProjectRepoRules
} from '#lib/author.ts';
import { cvDocumentInfo } from '#lib/cvVerification.ts';
import * as publicEnv from '$app/env/public';

const HOME_POST_LIMIT = 5;

export const load: PageServerLoad = async ({ fetch, parent }) => {
    const layoutData = parent();
    const postsPromise = loadPublishedPosts(fetch, { limit: HOME_POST_LIMIT });

    const [author, cv, funding, contact, skillsGrouped, cvDocument, repoRules, signingKey] =
        await Promise.all([
            fetchAuthorProfileWithSocials(supabase, { includeEmail: true }),
            fetchCvEntries(supabase),
            fetchFundingLinks(supabase),
            fetchContactInfo(supabase),
            fetchGroupedSkills(supabase),
            fetchActiveCvDocument(supabase, fetch),
            fetchProjectRepoRules(supabase),
            fetchActiveOpenPgpKey(supabase)
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
        cvDocument:
            cvDocument?.fileUrl ?
                cvDocumentInfo(
                    cvDocument,
                    signingKey && {
                        fingerprint: signingKey.fingerprint,
                        userIds: signingKey.userIds,
                        keyservers: signingKey.keyservers
                    },
                    author?.siteUrl || '',
                    publicEnv.PUBLIC_API_BASE_URL
                )
            :   null
    };
};
