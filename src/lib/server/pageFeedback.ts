import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityInputError, activityJson, activityTarget, activityUuid } from './activityInput';
import { isSameOriginRequest } from './sameOrigin';

export async function recordPageFeedback(input: {
    request: Request;
    url: URL;
    ip: () => string;
    secret: string | undefined;
    db: SupabaseClient | null;
    legacy?: boolean;
}) {
    const { request, url, secret, db, legacy } = input;
    const fail = (status: number, code: string, message: string) =>
        Response.json({ code, message }, { status });
    if (
        !isSameOriginRequest(request, url)
        || request.headers.get('sec-fetch-site') === 'cross-site'
    )
        return fail(403, 'FEEDBACK_ORIGIN_FORBIDDEN', 'Cross-origin requests are not allowed.');
    try {
        const body = await activityJson(request);
        const operationId = activityUuid(
            legacy && body.operationId == null ? crypto.randomUUID() : body.operationId
        );
        const target = activityTarget(
            legacy ? 'article' : body.targetType,
            legacy ? body.postId : body.targetId
        );
        if (body.vote !== 'yes' && body.vote !== 'no')
            throw new ActivityInputError('Choose Yes or No.');
        if (!db || !secret?.trim())
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback is temporarily unavailable. Please try again.'
            );
        const ip = input.ip();
        if (!ip)
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback is temporarily unavailable. Please try again.'
            );
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + secret));
        const ipHash = Array.from(new Uint8Array(bytes), value =>
            value.toString(16).padStart(2, '0')
        ).join('');
        const { data, error } = await db.rpc('db_record_page_feedback', {
            p_operation_id: operationId,
            p_target_type: target.type,
            p_target_id: target.id,
            p_vote: body.vote,
            p_ip_hash: ipHash
        });
        if (error) {
            if (error.message.includes('FEEDBACK_OPERATION_CONFLICT'))
                return fail(
                    409,
                    'FEEDBACK_OPERATION_CONFLICT',
                    'This feedback request has already been used.'
                );
            if (error.message.includes('FEEDBACK_TARGET_NOT_FOUND'))
                return fail(404, 'FEEDBACK_TARGET_NOT_FOUND', 'This page is not available.');
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback could not be saved. Please try again.'
            );
        }
        if (typeof data?.recorded !== 'boolean' || typeof data?.replayed !== 'boolean')
            return fail(
                503,
                'FEEDBACK_UNAVAILABLE',
                'Feedback could not be confirmed. Please try again.'
            );
        return Response.json(
            { recorded: data.recorded, replayed: data.replayed },
            { status: data.recorded && !data.replayed ? 201 : 200 }
        );
    } catch (error) {
        return error instanceof ActivityInputError ?
                fail(error.status, 'FEEDBACK_INVALID', error.message)
            :   fail(503, 'FEEDBACK_UNAVAILABLE', 'Feedback could not be saved. Please try again.');
    }
}
