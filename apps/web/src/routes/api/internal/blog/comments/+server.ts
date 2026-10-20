import { publicRepositories, serviceData } from '#lib/server/repositories.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isNameReserved, extractAuthorNameTokens } from '@fkp/domain/nameValidator.ts';
import { verifyTurnstileToken } from '#lib/server/turnstile.ts';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { workerBinding } from '#lib/server/workerEnv.ts';
import { moderateContent } from '#lib/server/moderation.ts';
import { PUBLIC_ID_PATTERN } from '@fkp/domain/postReference.ts';
import type { CommentCreation } from '@fkp/data';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }

    const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
    const turnstileOk = await verifyTurnstileToken(turnstileToken, getClientAddress(), platform);
    if (!turnstileOk) {
        return apiError(403, 'BLOG_COMMENT_TURNSTILE_FAILED', 'Turnstile verification failed.');
    }

    const publicId = typeof body?.postId === 'string' ? body.postId.trim() : '';
    const parentId =
        typeof body?.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
    const authorName = typeof body?.authorName === 'string' ? body.authorName.trim() : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) {
        return apiError(
            400,
            'BLOG_COMMENT_INVALID_POST_ID',
            'postId is required and must be a post ID.'
        );
    }
    if (parentId && !PUBLIC_ID_PATTERN.test(parentId)) {
        return apiError(400, 'BLOG_COMMENT_INVALID_PARENT_ID', 'parentId must be a comment ID.');
    }
    if (!content) {
        return apiError(400, 'BLOG_COMMENT_CONTENT_REQUIRED', 'content is required.');
    }
    if (content.length > 2000) {
        return apiError(
            400,
            'BLOG_COMMENT_CONTENT_TOO_LONG',
            'content must be 2000 characters or fewer.',
            `Received ${content.length} characters.`
        );
    }

    if (!authorName) {
        return apiError(400, 'BLOG_COMMENT_AUTHOR_NAME_REQUIRED', 'Author name is required.');
    }
    if (authorName.length < 2) {
        return apiError(
            400,
            'BLOG_COMMENT_AUTHOR_NAME_TOO_SHORT',
            'Author name must be at least 2 characters.'
        );
    }
    if (authorName.length > 50) {
        return apiError(
            400,
            'BLOG_COMMENT_AUTHOR_NAME_TOO_LONG',
            'Author name must be 50 characters or fewer.'
        );
    }

    const authorProfile = await publicRepositories()
        .author.profile()
        .catch(() => null);
    const authorTokens = extractAuthorNameTokens(authorProfile);
    if (isNameReserved(authorName, authorTokens)) {
        return apiError(
            400,
            'BLOG_COMMENT_AUTHOR_NAME_RESERVED',
            'This name cannot be used. Please use another name.'
        );
    }
    if (/(https?:\/\/|www\.[a-z0-9]|ftp:\/\/)/i.test(content)) {
        return apiError(
            400,
            'BLOG_COMMENT_LINKS_NOT_ALLOWED',
            'Links and URLs are not permitted in guest comments to prevent spam and phishing.'
        );
    }

    const moderation = await moderateContent(
        `Author: ${authorName}\nComment: ${content}`,
        await workerBinding('AI')
    );
    if (!moderation) {
        return apiError(
            503,
            'BLOG_COMMENT_MODERATION_UNAVAILABLE',
            'Comment moderation is temporarily unavailable. Please try again later.'
        );
    }

    const data = serviceData(platform);
    if (!data) {
        return apiError(
            500,
            'BLOG_COMMENT_SERVICE_UNAVAILABLE',
            'Comment submission is temporarily unavailable.'
        );
    }

    let created: CommentCreation;
    try {
        const lookup = await data.blog.findPublished(publicId);
        if (lookup.status !== 'found') {
            return apiError(404, 'BLOG_POST_NOT_FOUND', 'No published post matches postId.');
        }
        created = await data.writers.comments.create(lookup.post, {
            parentId,
            authorName,
            content,
            approved: moderation.safe
        });
    } catch (error) {
        console.error('Failed to save comment:', error);
        return apiError(500, 'BLOG_COMMENT_SAVE_FAILED', 'Could not save comment.');
    }
    if (created.status === 'invalid-parent') {
        return apiError(
            400,
            'BLOG_COMMENT_INVALID_PARENT_ID',
            'parentId must refer to a published comment on this post.'
        );
    }

    return json(
        {
            is_approved: moderation.safe,
            comment: created.comment,
            moderation: { engine: moderation.engine, categories: moderation.categories }
        },
        { status: 201 }
    );
};
