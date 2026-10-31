// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { oidcAdmin } from '#lib/server/oidc/admin.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const auth = await oidcAdmin(request, url, platform);
    if (!auth.ok) return auth.response;
    try {
        return Response.json(
            { grants: await auth.service.oidcAuth.listGrants() },
            { headers: NO_STORE }
        );
    } catch (error) {
        console.error('OIDC grant list failed:', error);
        return apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const auth = await oidcAdmin(request, url, platform);
    if (!auth.ok) return auth.response;
    let body: { action?: unknown; id?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'OIDC_GRANT_INVALID_INPUT', 'Invalid JSON body.');
    }
    if (body.action !== 'revoke' || typeof body.id !== 'string' || !/^[0-9a-f]{32}$/.test(body.id))
        return apiError(400, 'OIDC_GRANT_INVALID_INPUT', 'Invalid grant.');
    try {
        if (!(await auth.service.oidcAuth.revokeGrant(body.id)))
            return apiError(404, 'OIDC_GRANT_NOT_FOUND', 'Access not found.');
        await logAdminActivity(
            request,
            platform,
            {
                action: 'oidc.grant.revoke',
                category: 'security',
                entityId: body.id,
                summary: 'Revoked an app’s access.'
            },
            getClientAddress
        );
        return Response.json({ success: true }, { headers: NO_STORE });
    } catch (error) {
        console.error('OIDC grant revoke failed:', error);
        return apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.');
    }
};
