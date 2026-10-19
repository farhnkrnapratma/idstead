import * as publicEnv from '$app/env/public';
import { supabase } from '#lib/supabase.ts';
import { withoutExcludedProjects } from '#lib/server/projectsCache.ts';
import { loadPublishedPosts } from '#lib/server/blogPosts.ts';
import {
    fetchActiveCvDocument,
    fetchActiveOpenPgpKey,
    fetchCvEntries,
    fetchProjectRepoRules
} from '#lib/author.ts';
import { cvDocumentInfo } from '#lib/cvVerification.ts';
import type { PageServerLoad } from './$types';

const HOME_POST_COUNT = 3;
const HOME_POST_CANDIDATES = 10;
const HOME_EXPERIENCE_COUNT = 2;
const HOME_EDUCATION_COUNT = 1;

export const load: PageServerLoad = async ({ fetch, parent }) => {
    const [{ author, projects }, cv, posts, repoRules, cvDocument, signingKey] = await Promise.all([
        parent(),
        fetchCvEntries(supabase),
        loadPublishedPosts(fetch, { limit: HOME_POST_CANDIDATES }),
        fetchProjectRepoRules(supabase),
        fetchActiveCvDocument(supabase, fetch),
        fetchActiveOpenPgpKey(supabase)
    ]);

    return {
        projects: withoutExcludedProjects(projects, repoRules.excluded),
        pinnedRepoNames: repoRules.pinned,
        posts: posts.filter(post => !post.pinned).slice(0, HOME_POST_COUNT),
        experience: cv.experience.slice(0, HOME_EXPERIENCE_COUNT),
        education: cv.education.slice(0, HOME_EDUCATION_COUNT),
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
