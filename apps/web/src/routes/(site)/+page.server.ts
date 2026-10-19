import { supabase } from '#lib/supabase.ts';
import { loadPublishedPosts } from '#lib/server/blogPosts.ts';
import { loadPublicCvDocument } from '#lib/server/publicCvDocument.ts';
import { fetchCvEntries } from '#lib/author.ts';
import type { PageServerLoad } from './$types';

const HOME_POST_COUNT = 3;
const HOME_POST_CANDIDATES = 10;
const HOME_EXPERIENCE_COUNT = 2;
const HOME_EDUCATION_COUNT = 1;

export const load: PageServerLoad = async ({ fetch }) => {
    const [cv, posts, cvDocument] = await Promise.all([
        fetchCvEntries(supabase),
        loadPublishedPosts(fetch, { limit: HOME_POST_CANDIDATES }),
        loadPublicCvDocument(fetch)
    ]);

    return {
        posts: posts.filter(post => !post.pinned).slice(0, HOME_POST_COUNT),
        experience: cv.experience.slice(0, HOME_EXPERIENCE_COUNT),
        education: cv.education.slice(0, HOME_EDUCATION_COUNT),
        cvDocument
    };
};
