import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { serviceData } from '#lib/server/repositories.ts';
import { PUBLIC_ID_PATTERN } from '@idstead/domain/postReference.ts';
import { hashIp } from '@idstead/domain/hash.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, getClientAddress, platform }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    const data = serviceData(platform);
    if (!data) return apiError(503, 'BLOG_VIEW_UNAVAILABLE', 'View counting is not configured.');

    try {
        const body = await request.json();
        const publicId = typeof body?.postId === 'string' ? body.postId.trim() : '';
        if (!publicId) {
            return apiError(400, 'BLOG_VIEW_POST_ID_REQUIRED', 'postId is required.');
        }
        const lookup =
            PUBLIC_ID_PATTERN.test(publicId) ? await data.blog.findPublished(publicId) : null;
        if (lookup?.status !== 'found') {
            return apiError(404, 'BLOG_POST_NOT_FOUND', 'No published post matches postId.');
        }

        const salt = ipSalt(platform);
        if (!salt)
            return apiError(
                503,
                'BLOG_VIEW_UNAVAILABLE',
                'View counting is temporarily unavailable.'
            );
        const today = new Date().toISOString().split('T')[0];
        const visitorKey = `${today}_${await hashIp(getClientAddress(), salt)}`;
        const { counted, views } = await data.writers.views.record(lookup.post, visitorKey);

        return json({ counted, views }, { status: counted ? 201 : 200 });
    } catch (err) {
        console.error('View tracking error:', err);
        return apiError(
            500,
            'BLOG_VIEW_TRACKING_FAILED',
            'An unexpected error occurred while recording views.'
        );
    }
};
