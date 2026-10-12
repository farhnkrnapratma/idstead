import type { PageServerLoad } from './$types';
import { loadPublishedPosts } from '#lib/server/blogPosts.ts';

export const load: PageServerLoad = async ({ fetch }) => ({
    posts: await loadPublishedPosts(fetch)
});
