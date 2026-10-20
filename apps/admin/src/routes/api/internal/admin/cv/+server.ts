import { getSupabaseUserClient } from '#lib/server/supabaseUser.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { createSupabaseAdminAuthorStore, createSupabaseAuthorWriter } from '@idstead/data';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const userDb = getSupabaseUserClient(request, platform);
    const db = getSupabaseAdminClient(platform);
    if (!db || !userDb) return apiError(503, 'CV_STORAGE_UNAVAILABLE', 'Database is unavailable.');

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'CV_INVALID_INPUT', 'Invalid JSON body.');
    }
    const { experiences, education } = body ?? {};
    if (!Array.isArray(experiences) || !Array.isArray(education))
        return apiError(400, 'CV_INVALID_INPUT', 'Invalid CV data.');

    let authorId: string;
    try {
        authorId = await createSupabaseAdminAuthorStore(db).ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'CV_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await createSupabaseAuthorWriter(userDb).saveCv(
        authorId,
        experiences,
        education
    );
    if (result.status === 'rejected') return apiError(400, 'CV_SAVE_FAILED', result.message);

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'cv.entries_update',
            category: 'cv',
            summary: `Saved ${experiences.length} experience and ${education.length} education entries.`,
            ip: (() => {
                try {
                    return getClientAddress();
                } catch {
                    return null;
                }
            })(),
            ipSalt: ipSalt(platform),
            userAgent: request.headers.get('user-agent') ?? undefined
        },
        db
    );

    return json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
