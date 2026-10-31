// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

const CATEGORIES = ['social', 'funding', 'contact'] as const;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'LINKS_STORAGE_UNAVAILABLE'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'LINKS_INVALID_INPUT', 'Invalid JSON body.');
    }
    const { category, items } = body ?? {};
    if (!CATEGORIES.includes(category) || !Array.isArray(items))
        return apiError(400, 'LINKS_INVALID_INPUT', 'Invalid links data.');

    let authorId: string;
    try {
        authorId = await service.adminAuthor.ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'LINKS_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await service.authorWriter.saveLinks(authorId, category, items);
    if (result.status === 'rejected') return apiError(400, 'LINKS_SAVE_FAILED', result.message);

    await logAdminActivity(
        request,
        platform,
        {
            action: 'links.update',
            category: 'links',
            entityId: category,
            summary: `Saved ${items.length} ${category} links.`
        },
        getClientAddress
    );

    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
