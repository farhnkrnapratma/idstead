import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({
    funding: await publicRepositories(fetch)
        .author.fundingLinks()
        .catch(() => [])
});
