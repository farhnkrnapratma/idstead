import { loadPublishedPosts } from '#lib/server/blogPosts.ts';
import { loadPublicCvDocument } from '#lib/server/publicCvDocument.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

const HOME_POST_COUNT = 3;
const HOME_EXPERIENCE_COUNT = 2;
const HOME_EDUCATION_COUNT = 1;

export const load: PageServerLoad = async ({ fetch }) => {
    const [cv, posts, cvDocument] = await Promise.all([
        publicRepositories(fetch)
            .author.cvEntries()
            .catch(() => ({ experience: [], education: [] })),
        loadPublishedPosts(fetch, { limit: HOME_POST_COUNT, pinnedFirst: true }),
        loadPublicCvDocument(fetch)
    ]);

    return {
        posts,
        hasPublishedPosts: posts.length > 0,
        experience: cv.experience.slice(0, HOME_EXPERIENCE_COUNT),
        education: cv.education.slice(0, HOME_EDUCATION_COUNT),
        cvDocument
    };
};
