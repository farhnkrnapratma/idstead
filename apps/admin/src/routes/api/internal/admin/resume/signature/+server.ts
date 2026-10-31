// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { processResumeSignature } from '#lib/server/adminResume.ts';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';

const handle: RequestHandler = async ({ request, platform, url, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    return processResumeSignature(request, platform, getClientAddress);
};

export const POST = handle;
export const DELETE = handle;
