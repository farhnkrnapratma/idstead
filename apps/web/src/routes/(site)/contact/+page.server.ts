// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { publicRepositories } from '#lib/server/repositories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    const { author } = publicRepositories(fetch);
    const [contact, profile] = await Promise.all([
        author.contactLinks().catch(() => []),
        author.profile({ includeEmail: true }).catch(() => null)
    ]);
    const hasEmailChannel = contact.some(
        item => item.platform.toLowerCase() === 'email' || item.href.startsWith('mailto:')
    );
    return { contact, canSendMessage: hasEmailChannel || Boolean(profile?.email?.trim()) };
};
