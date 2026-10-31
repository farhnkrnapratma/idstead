// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, { code: 'AUTHOR_UNAVAILABLE' });
    if (admin.response) return admin.response;
    const { service } = admin;
    const part = url.searchParams.get('part') ?? 'all';
    if (part !== 'all' && part !== 'profile')
        return apiError(400, 'AUTHOR_INVALID_PART', 'part must be all or profile.');
    const store = service.adminAuthor;
    try {
        const body =
            part === 'profile' ? { profile: await store.profile() } : await store.snapshot();
        return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Admin author load failed:', error);
        return apiError(503, 'AUTHOR_UNAVAILABLE', 'Author data could not be loaded.');
    }
};
