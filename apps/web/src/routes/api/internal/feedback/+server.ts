// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { serviceData } from '#lib/server/repositories.ts';
import { recordPageFeedback } from '#lib/server/pageFeedback.ts';
import type { RequestHandler } from './$types';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = ({ request, url, platform, getClientAddress }) => {
    const service = serviceData(platform);
    return recordPageFeedback({
        request,
        url,
        data: service && { blog: service.blog, feedback: service.writers.feedback },
        ip: getClientAddress,
        secret: ipSalt(platform)
    });
};
