// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { loadPublishedPosts } from '#lib/server/blogPosts.ts';
import { loadPublicResumeDocument } from '#lib/server/publicResumeDocument.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

const HOME_POST_COUNT = 3;
const HOME_EXPERIENCE_COUNT = 2;
const HOME_EDUCATION_COUNT = 1;

export const load: PageServerLoad = async ({ fetch }) => {
    const [resume, posts, resumeDocument] = await Promise.all([
        publicRepositories(fetch)
            .author.resumeEntries()
            .catch(() => ({ experience: [], education: [] })),
        loadPublishedPosts(fetch, { limit: HOME_POST_COUNT, pinnedFirst: true }),
        loadPublicResumeDocument(fetch)
    ]);

    return {
        posts,
        hasPublishedPosts: posts.length > 0,
        experience: resume.experience.slice(0, HOME_EXPERIENCE_COUNT),
        education: resume.education.slice(0, HOME_EDUCATION_COUNT),
        resumeDocument
    };
};
