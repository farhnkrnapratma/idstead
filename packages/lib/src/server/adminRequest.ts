// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { adminActor, verifyAdminRequest } from './adminAuth';
import { clientAddress, logActivity, type ActivityCategory } from './activityLog';
import { apiError } from './apiError';
import { dataStores, type ServiceStores } from './data';
import { ipSalt } from './ipSalt';
import { isSameOriginRequest } from './sameOrigin';

export async function requireAdminAuth(req: Request, platform?: unknown): Promise<Response | null> {
    const auth = await verifyAdminRequest(req, platform);
    if (auth.status)
        return apiError(
            auth.status,
            auth.status === 401 ? 'ADMIN_AUTH_REQUIRED' : 'ADMIN_FORBIDDEN',
            auth.message
        );
    return null;
}

export async function requireSameOriginAdmin(
    req: Request,
    url: URL,
    platform?: unknown
): Promise<Response | null> {
    if (!isSameOriginRequest(req, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    return requireAdminAuth(req, platform);
}

export type AdminServices =
    { service: ServiceStores; response?: never } | { service?: never; response: Response };

export async function adminServices(
    req: Request,
    url: URL,
    platform: unknown,
    unavailable: { code: string; message?: string }
): Promise<AdminServices> {
    const denied = await requireSameOriginAdmin(req, url, platform);
    if (denied) return { response: denied };
    const service = dataStores(platform).service;
    if (!service)
        return {
            response: apiError(
                503,
                unavailable.code,
                unavailable.message ?? 'Database is unavailable.'
            )
        };
    return { service };
}

export async function logAdminActivity(
    req: Request,
    platform: unknown,
    entry: {
        action: string;
        category: ActivityCategory;
        entityId?: string | null;
        summary: string;
        details?: Record<string, unknown> | null;
    },
    getClientAddress?: () => string
) {
    await logActivity(
        {
            actor: await adminActor(req, platform),
            ...entry,
            ip: clientAddress(getClientAddress),
            ipSalt: ipSalt(platform),
            userAgent: req.headers.get('user-agent') ?? undefined
        },
        dataStores(platform).service?.activityLog
    );
}
