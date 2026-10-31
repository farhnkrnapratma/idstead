import type { RequestHandler } from './$types';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { isLegalSlug } from '@idstead/domain/legal.ts';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 200_000;

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, { code: 'LEGAL_UNAVAILABLE' });
    if (admin.response) return admin.response;
    const { service } = admin;
    try {
        const pages = await service.legal.pages();
        return Response.json({ pages }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Legal pages could not be loaded:', error);
        return apiError(503, 'LEGAL_UNAVAILABLE', 'Legal pages could not be loaded.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, { code: 'LEGAL_UNAVAILABLE' });
    if (admin.response) return admin.response;
    const { service } = admin;

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

    const result = await service.legalWriter.save({ slug, title, content });
    if (result.status === 'rejected') return apiError(400, 'LEGAL_SAVE_FAILED', result.message);

    await logAdminActivity(
        request,
        platform,
        {
            action: 'legal.update',
            category: 'profile',
            entityId: slug,
            summary: `Saved the ${slug} page.`
        },
        getClientAddress
    );
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
