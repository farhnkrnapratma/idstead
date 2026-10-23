import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { isLegalSlug } from '@idstead/domain/legal.ts';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 200_000;

export const GET: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;
    const service = dataStores(platform).service;
    if (!service) return apiError(503, 'LEGAL_UNAVAILABLE', 'Database is unavailable.');
    try {
        const pages = await service.legal.pages();
        return Response.json({ pages }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Legal pages could not be loaded:', error);
        return apiError(503, 'LEGAL_UNAVAILABLE', 'Legal pages could not be loaded.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;
    const db = getSupabaseAdminClient(platform);
    const { service, session } = dataStores(platform, { request, verifiedAdmin: true });
    if (!db || !service || !session)
        return apiError(503, 'LEGAL_UNAVAILABLE', 'Database is unavailable.');

    let body: { slug?: unknown; title?: unknown; content?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'LEGAL_INVALID_INPUT', 'Invalid JSON body.');
    }
    const slug = body?.slug;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.content === 'string' ? body.content : null;
    if (typeof slug !== 'string' || !isLegalSlug(slug))
        return apiError(400, 'LEGAL_INVALID_INPUT', 'Unknown legal page.');
    if (!title || title.length > MAX_TITLE_LENGTH)
        return apiError(400, 'LEGAL_INVALID_INPUT', 'A title of up to 200 characters is required.');
    if (content === null || !content.trim() || content.length > MAX_CONTENT_LENGTH)
        return apiError(
            400,
            'LEGAL_INVALID_INPUT',
            'Content is required and must fit 200,000 characters.'
        );

    const result = await session.legalWriter.save({ slug, title, content });
    if (result.status === 'rejected') return apiError(400, 'LEGAL_SAVE_FAILED', result.message);

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'legal.update',
            category: 'profile',
            entityId: slug,
            summary: `Saved the ${slug} page.`,
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
