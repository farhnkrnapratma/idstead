import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const db = getSupabaseAdminClient(platform);

    const { service, session } = dataStores(platform, { request, verifiedAdmin: true });
    if (!db || !service || !session)
        return apiError(503, 'SKILLS_STORAGE_UNAVAILABLE', 'Database is unavailable.');

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'SKILLS_INVALID_INPUT', 'Invalid JSON body.');
    }
    const { categories } = body ?? {};
    if (!Array.isArray(categories))
        return apiError(400, 'SKILLS_INVALID_INPUT', 'Invalid skills data.');

    let authorId: string;
    try {
        authorId = await service.adminAuthor.ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'SKILLS_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await session.authorWriter.saveSkills(authorId, categories);
    if (result.status === 'rejected') return apiError(400, 'SKILLS_SAVE_FAILED', result.message);

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'skills.update',
            category: 'skills',
            summary: `Saved ${categories.length} skill categories.`,
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
        service.activityLog
    );

    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
