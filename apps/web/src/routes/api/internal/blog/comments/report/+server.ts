import type { RequestHandler } from './$types';
import { readPublicWrite } from '#lib/server/publicWrite.ts';
import { apiError } from '#lib/server/apiError.ts';
import { serviceData } from '#lib/server/repositories.ts';
import { hashIp } from '@idstead/domain/hash.ts';
import { REPORT_REASON_IDS } from '#lib/reportReasons.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { PUBLIC_ID_PATTERN } from '@idstead/domain/postReference.ts';

export const POST: RequestHandler = async event => {
    const { platform, getClientAddress } = event;
    const parsed = await readPublicWrite(event, 'BLOG_COMMENT_REPORT_TURNSTILE_FAILED');
    if (parsed.response) return parsed.response;
    const { body } = parsed;

    const commentId = typeof body?.commentId === 'string' ? body.commentId.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 500) : '';

    if (!commentId || !PUBLIC_ID_PATTERN.test(commentId)) {
        return apiError(
            400,
            'BLOG_COMMENT_REPORT_INVALID_COMMENT_ID',
            'commentId must be a comment ID.'
        );
    }

    if (!reason || !REPORT_REASON_IDS.has(reason)) {
        return apiError(
            400,
            'BLOG_COMMENT_REPORT_INVALID_REASON',
            'A valid report reason is required.'
        );
    }

    const salt = ipSalt(platform);
    if (!salt)
        return apiError(
            503,
            'BLOG_COMMENT_REPORT_UNAVAILABLE',
            'Reporting is temporarily unavailable.'
        );

    const data = serviceData(platform);
    if (!data) {
        return apiError(
            500,
            'BLOG_COMMENT_REPORT_SERVICE_UNAVAILABLE',
            'Report service is temporarily unavailable.'
        );
    }

    let outcome: 'reported' | 'not-found';
    try {
        outcome = await data.writers.comments.report(commentId, {
            reason,
            details: details || null,
            reporterIpHash: await hashIp(getClientAddress(), salt)
        });
    } catch (error) {
        console.error('Failed to save comment report:', error);
        return apiError(500, 'BLOG_COMMENT_REPORT_SAVE_FAILED', 'Could not save report.');
    }
    if (outcome === 'not-found') {
        return apiError(
            404,
            'BLOG_COMMENT_REPORT_COMMENT_NOT_FOUND',
            'The specified comment was not found.'
        );
    }

    return Response.json({ success: true }, { status: 201 });
};
