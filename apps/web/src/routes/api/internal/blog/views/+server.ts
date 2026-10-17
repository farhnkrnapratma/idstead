import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { resolvePostUuid } from '#lib/server/postLookup.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, getClientAddress, platform }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    const supabase = getSupabaseAdminClient(platform);
    if (!supabase)
        return apiError(503, 'BLOG_VIEW_UNAVAILABLE', 'View counting is not configured.');

    try {
        const body = await request.json();
        const publicId = typeof body?.postId === 'string' ? body.postId.trim() : '';
        if (!publicId) {
            return apiError(400, 'BLOG_VIEW_POST_ID_REQUIRED', 'postId is required.');
        }
        const postId = await resolvePostUuid(supabase, publicId);
        if (!postId) {
            return apiError(404, 'BLOG_POST_NOT_FOUND', 'No published post matches postId.');
        }

        const ip = getClientAddress();

        const salt = ipSalt(platform);
        if (!salt)
            return apiError(
                503,
                'BLOG_VIEW_UNAVAILABLE',
                'View counting is temporarily unavailable.'
            );
        const ipHashBuffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(ip + salt)
        );
        const ipHash = Array.from(new Uint8Array(ipHashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const today = new Date().toISOString().split('T')[0];
        const dailyKey = `${today}_${ipHash}`;

        const { data: existing } = await supabase
            .from('db_views')
            .select('id')
            .eq('post_id', postId)
            .eq('ip_hash', dailyKey)
            .maybeSingle();

        if (!existing) {
            await supabase
                .from('db_views')
                .insert({
                    post_id: postId,
                    ip_hash: dailyKey,
                    viewed_at: new Date().toISOString()
                });
        }

        const { count } = await supabase
            .from('db_views')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', postId);

        return json({ counted: !existing, views: count ?? 0 }, { status: existing ? 200 : 201 });
    } catch (err) {
        console.error('View tracking error:', err);
        return apiError(
            500,
            'BLOG_VIEW_TRACKING_FAILED',
            'An unexpected error occurred while recording views.'
        );
    }
};
