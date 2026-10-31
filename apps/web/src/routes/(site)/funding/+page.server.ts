// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({
    funding: await publicRepositories(fetch)
        .author.fundingLinks()
        .catch(() => [])
});
