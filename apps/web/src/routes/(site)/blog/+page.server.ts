// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PageServerLoad } from './$types';
import { loadPublishedPosts } from '#lib/server/blogPosts.ts';

export const load: PageServerLoad = async ({ fetch }) => ({
    posts: await loadPublishedPosts(fetch)
});
