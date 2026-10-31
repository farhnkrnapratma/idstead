// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { isSameOriginRequest } from './sameOrigin';
import { verifyAdminRequest, type AdminAuth } from './adminAuth';

export async function blogAdmin(
    request: Request,
    url: URL,
    platform?: unknown
): Promise<AdminAuth> {
    if (!isSameOriginRequest(request, url))
        return {
            status: 403,
            code: 'FORBIDDEN_ORIGIN',
            message: 'Cross-origin requests are not allowed.'
        };
    return verifyAdminRequest(request, platform);
}
