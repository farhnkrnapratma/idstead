// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { logAdminActivity, requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { sanitizeInput } from '@idstead/domain/sanitizeInput.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const payload = body as {
        postId?: unknown;
        parentId?: unknown;
        authorName?: unknown;
        content?: unknown;
    };

    const postId = typeof payload?.postId === 'string' ? payload.postId.trim() : '';
    const parentId = typeof payload?.parentId === 'string' ? payload.parentId.trim() : '';
    const authorName =
        typeof payload?.authorName === 'string' && payload.authorName.trim() ?
            sanitizeInput(payload.authorName.trim())
        :   'Administrator';
    const rawContent = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const content = sanitizeInput(rawContent);

    if (!postId || !UUID_RE.test(postId)) {
        return apiError(400, 'BLOG_COMMENT_INVALID_POST_ID', 'postId must be a valid UUID.');
    }
    if (!parentId || !UUID_RE.test(parentId)) {
        return apiError(400, 'BLOG_COMMENT_INVALID_PARENT_ID', 'parentId must be a valid UUID.');
    }
    if (!content) {
        return apiError(400, 'BLOG_COMMENT_CONTENT_REQUIRED', 'content is required.');
    }
    if (content.length > 2000) {
        return apiError(
            400,
            'BLOG_COMMENT_CONTENT_TOO_LONG',
            'content must be 2000 characters or fewer.'
        );
    }
    const service = dataStores(platform).service;
    if (!service) {
        return apiError(500, 'DATABASE_UNAVAILABLE', 'Database client unavailable.');
    }

    let result;
    try {
        result = await service.adminActivity.replyToComment({
            postId,
            parentId,
            authorName,
            content
        });
    } catch {
        return apiError(500, 'BLOG_COMMENT_SAVE_FAILED', 'Could not save admin reply.');
    }
    if (result.status === 'invalid-parent')
        return apiError(
            400,
            'BLOG_COMMENT_INVALID_PARENT_ID',
            'parentId must be a comment on the same post.'
        );

    await logAdminActivity(
        request,
        platform,
        {
            action: 'blog.comment_reply',
            category: 'blog',
            entityId: parentId,
            summary: 'Replied to a comment.'
        },
        getClientAddress
    );
    return Response.json({ comment: result.comment }, { status: 201 });
};
