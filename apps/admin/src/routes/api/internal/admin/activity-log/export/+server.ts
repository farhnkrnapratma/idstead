// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import {
    formatActivityLogText,
    generateActivityLogPdf,
    type ActivityLogRow
} from '#lib/server/activityLogExport.ts';

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
    const format = url.searchParams.get('format') ?? 'pdf';
    if (format !== 'txt' && format !== 'pdf')
        return apiError(400, 'ACTIVITY_LOG_INVALID_FORMAT', 'Invalid export format.');
    const { limit: _limit, offset: _offset, ...filter } = query;
    let page;
    try {
        page = await service.activityLog.export(filter);
    } catch {
        return apiError(503, 'ACTIVITY_LOG_EXPORT_FAILED', 'Could not export activity log.');
    }

    const rows = page.data as ActivityLogRow[];
    const exportHeaders = { 'X-Total-Count': String(page.total), 'X-Export-Limit': '5000' };
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'txt') {
        return new Response(formatActivityLogText(rows), {
            headers: {
                ...exportHeaders,
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="activity-log-${stamp}.txt"`,
                'Cache-Control': 'no-store'
            }
        });
    }

    const pdfBytes = await generateActivityLogPdf(rows);
    return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
            ...exportHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="activity-log-${stamp}.pdf"`,
            'Cache-Control': 'no-store'
        }
    });
};
