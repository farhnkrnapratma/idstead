import { getSupabaseUserClient } from '#lib/server/supabaseUser.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import * as privateEnv from '$app/env/private';

const CATEGORIES = ['social', 'funding', 'contact'] as const;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const userDb = getSupabaseUserClient(request, platform);
    const db = getSupabaseAdminClient(platform);
    if (!db || !userDb)
        return apiError(503, 'LINKS_STORAGE_UNAVAILABLE', 'Database is unavailable.');

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'LINKS_INVALID_INPUT', 'Invalid JSON body.');
    }
    const { authorId, category, items } = body ?? {};
    if (typeof authorId !== 'string' || !CATEGORIES.includes(category) || !Array.isArray(items))
        return apiError(400, 'LINKS_INVALID_INPUT', 'Invalid links data.');

    const { error } = await userDb.rpc('db_save_links', {
        p_author_id: authorId,
        p_category: category,
        p_items: items
    });
    if (error) return apiError(400, 'LINKS_SAVE_FAILED', error.message || 'Save failed.');

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'links.update',
            category: 'links',
            entityId: category,
            summary: `Saved ${items.length} ${category} links.`,
            ip: (() => {
                try {
                    return getClientAddress();
                } catch {
                    return null;
                }
            })(),
            ipSalt:
                (platform as { env?: { IP_SALT?: string } } | undefined)?.env?.IP_SALT
                ?? privateEnv.IP_SALT
                ?? '',
            userAgent: request.headers.get('user-agent') ?? undefined
        },
        db
    );

    return json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
