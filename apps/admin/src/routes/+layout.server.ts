// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { LayoutServerLoad } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';
import { avatarSource } from '#lib/siteIdentity.ts';

export const load: LayoutServerLoad = async ({ fetch }) => {
    const { author: authorRepository } = publicRepositories(fetch);
    const [profile, socialLinks] = await Promise.all([
        authorRepository.profile().catch(() => null),
        authorRepository.socialLinks().catch(() => [])
    ]);
    const author = profile ? { ...profile, socialLinks } : null;
    return { author: author ? { ...author, avatar: avatarSource(author) } : author };
};
