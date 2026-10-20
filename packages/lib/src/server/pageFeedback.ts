import { hashIp } from '@idstead/domain/hash.ts';
import type { BlogRepository, FeedbackRecorder, FeedbackTarget, LegalPageId } from '@idstead/data';
import { PUBLIC_ID_PATTERN } from '@idstead/domain/postReference.ts';
import { ActivityInputError, activityJson, activityTarget, activityUuid } from './activityInput';
import { isSameOriginRequest } from './sameOrigin';
import { apiError } from './apiError';

export async function recordPageFeedback(input: {
    request: Request;
    url: URL;
    ip: () => string;
    secret: string | undefined;
    data: { blog: BlogRepository; feedback: FeedbackRecorder } | null;
}) {
    const { request, url, secret, data } = input;
    const fail = apiError;
    if (
        !isSameOriginRequest(request, url)
        || request.headers.get('sec-fetch-site') === 'cross-site'
    )
        return fail(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are not allowed.');
    try {
        const body = await activityJson(request);
        const operationId = activityUuid(body.operationId);
        const targetType = body.targetType;
        const targetId = body.targetId;
        if (body.vote !== 'yes' && body.vote !== 'no')
            throw new ActivityInputError('Choose Yes or No.');
        if (!data || !secret?.trim())
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback is temporarily unavailable. Please try again.'
            );
        let target: FeedbackTarget;
        if (targetType === 'article') {
            const found =
                typeof targetId === 'string' && PUBLIC_ID_PATTERN.test(targetId) ?
                    await data.blog.findPublished(targetId)
                :   null;
            if (found?.status !== 'found')
                return fail(404, 'FEEDBACK_TARGET_NOT_FOUND', 'This page is not available.');
            target = { type: 'article', post: found.post };
        } else {
            target = {
                type: 'legal',
                page: activityTarget(targetType, targetId).id as LegalPageId
            };
        }
        const ip = input.ip();
        if (!ip)
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback is temporarily unavailable. Please try again.'
            );
        const result = await data.feedback.record(target, {
            operationId,
            vote: body.vote,
            ipHash: await hashIp(ip, secret)
        });
        if (result.status === 'operation-conflict')
            return fail(
                409,
                'FEEDBACK_OPERATION_CONFLICT',
                'This feedback request has already been used.'
            );
        if (result.status === 'target-not-found')
            return fail(404, 'FEEDBACK_TARGET_NOT_FOUND', 'This page is not available.');
        return Response.json(
            { recorded: result.recorded, replayed: result.replayed },
            { status: result.recorded && !result.replayed ? 201 : 200 }
        );
    } catch (error) {
        return error instanceof ActivityInputError ?
                fail(error.status, 'FEEDBACK_INVALID', error.message)
            :   fail(503, 'FEEDBACK_UNAVAILABLE', 'Feedback could not be saved. Please try again.');
    }
}
