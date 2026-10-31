// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { activityLogQuery } from '#lib/server/activityLogQuery.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'ACTIVITY_LOG_UNAVAILABLE',
        message: 'Activity log is temporarily unavailable.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    let query;
    try {
        query = activityLogQuery(url.searchParams);
    } catch (error) {
        return apiError(
            400,
            'ACTIVITY_LOG_INVALID_QUERY',
            error instanceof Error ? error.message : 'Invalid query.'
        );
    }
    let page;
    try {
        page = await service.activityLog.list(query);
    } catch {
        return apiError(503, 'ACTIVITY_LOG_FETCH_FAILED', 'Could not load activity log.');
    }

    return Response.json(
        { data: page.data, total: page.total, limit: query.limit, offset: query.offset },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
