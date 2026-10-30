import type { RequestHandler } from './$types';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'SKILLS_STORAGE_UNAVAILABLE'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

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
    const result = await service.authorWriter.saveSkills(authorId, categories);
    if (result.status === 'rejected') return apiError(400, 'SKILLS_SAVE_FAILED', result.message);

    await logAdminActivity(
        request,
        platform,
        {
            action: 'skills.update',
            category: 'skills',
            summary: `Saved ${categories.length} skill categories.`
        },
        getClientAddress
    );

    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
