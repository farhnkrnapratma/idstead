import { loadPublicResumeDocument } from '#lib/server/publicResumeDocument.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    const { author } = publicRepositories(fetch);
    const [resume, skills, resumeDocument] = await Promise.all([
        author.resumeEntries().catch(() => ({ experience: [], education: [] })),
        author.skillGroups().catch(() => []),
        loadPublicResumeDocument(fetch)
    ]);
    return { resume, skills, resumeDocument };
};
