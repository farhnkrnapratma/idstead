// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PageServerLoad } from './$types';
import { serviceData } from '#lib/server/repositories.ts';
import { hashToken } from '#lib/server/subscribers.ts';

export const load: PageServerLoad = async ({ url, platform }) => {
    const token = url.searchParams.get('token') ?? '';
    if (!/^[0-9a-f]{64}$/.test(token)) return { state: 'invalid' as const };

    const subscribers = serviceData(platform)?.writers.subscribers;
    if (!subscribers) return { state: 'unavailable' as const };

    try {
        return { state: await subscribers.confirm(await hashToken(token)) };
    } catch (error) {
        console.error('Failed to confirm subscriber:', error);
        return { state: 'unavailable' as const };
    }
};
