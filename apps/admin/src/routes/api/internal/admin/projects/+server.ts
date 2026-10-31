// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { sanitizeInput } from '@idstead/domain/sanitizeInput.ts';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

const MAX_PINNED = 3;
const MAX_EXCLUDED = 100;
const MAX_NAME_LENGTH = 100;

function repoNames(value: unknown, max: number) {
    if (!Array.isArray(value) || value.length > max) return null;
    const names: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.length > MAX_NAME_LENGTH) return null;
        const name = sanitizeInput(item.trim());
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'PROJECTS_STORAGE_UNAVAILABLE'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    let body: { pinned?: unknown; excluded?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'PROJECTS_INVALID_INPUT', 'Invalid JSON body.');
    }
    const pinned = repoNames(body?.pinned, MAX_PINNED);
    const excluded = repoNames(body?.excluded, MAX_EXCLUDED);
    if (!pinned)
        return apiError(
            400,
            'PROJECTS_INVALID_INPUT',
            `Pin at most ${MAX_PINNED} repositories by name.`
        );
    if (!excluded)
        return apiError(
            400,
            'PROJECTS_INVALID_INPUT',
            `Exclude at most ${MAX_EXCLUDED} repositories by name.`
        );

    let authorId: string;
    try {
        authorId = await service.adminAuthor.ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'PROJECTS_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await service.authorWriter.saveRepoRules(authorId, { pinned, excluded });
    if (result.status === 'rejected') return apiError(400, 'PROJECTS_SAVE_FAILED', result.message);

    await logAdminActivity(
        request,
        platform,
        {
            action: 'projects.update',
            category: 'profile',
            summary: `Saved ${pinned.length} pinned and ${excluded.length} excluded repositories.`
        },
        getClientAddress
    );

    return Response.json(
        { success: true, pinned, excluded },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
