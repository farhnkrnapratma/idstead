// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import { validateDefineForSave } from '@mdrs/core';
import { fetchJson } from '#lib/server/mdrsFetch.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Request body must be valid JSON.');
    }

    const source =
        body && typeof body === 'object' ? (body as { markdown?: unknown }).markdown : undefined;
    const markdown = typeof source === 'string' ? source.trim() : '';
    if (!markdown) {
        return apiError(400, 'BLOG_DEFINE_MARKDOWN_REQUIRED', 'Markdown content is required.');
    }

    const { ok, errors } = await validateDefineForSave(markdown, fetchJson);

    if (!ok) {
        const messages = errors.map(e => (e.key ? `${e.key}: ${e.message}` : e.message));
        return apiError(
            422,
            'BLOG_DEFINE_VALIDATION_FAILED',
            messages.join(' | '),
            messages.join('\n')
        );
    }

    return Response.json({ errors: [] });
};
