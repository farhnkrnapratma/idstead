// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import { DefineError, checkGetUrl } from '@mdrs/core';
import { apiError } from '#lib/server/apiError.ts';
import { fetchJson } from '#lib/server/mdrsFetch.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const target = typeof body?.url === 'string' ? body.url : '';
    try {
        checkGetUrl(target);
    } catch (error) {
        return apiError(400, 'MDRS_GET_URL_INVALID', (error as Error).message);
    }
    try {
        const data = await fetchJson(target);
        return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof DefineError) return apiError(502, 'MDRS_GET_FAILED', error.message);
        console.error('MDRS get() failed:', error);
        return apiError(502, 'MDRS_GET_FAILED', 'The URL could not be fetched right now.');
    }
};
