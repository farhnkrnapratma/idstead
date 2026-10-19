import { loadPublicCvDocument } from '#lib/server/publicCvDocument.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    const { author } = publicRepositories(fetch);
    const [cv, skills, cvDocument] = await Promise.all([
        author.cvEntries().catch(() => ({ experience: [], education: [] })),
        author.skillGroups().catch(() => []),
        loadPublicCvDocument(fetch)
    ]);
    return { cv, skills, cvDocument };
};
