import type { RequestHandler } from './$types';
import { adminServices, logAdminActivity } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'RESUME_STORAGE_UNAVAILABLE'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'RESUME_INVALID_INPUT', 'Invalid JSON body.');
    }
    const { experiences, education } = body ?? {};
    if (!Array.isArray(experiences) || !Array.isArray(education))
        return apiError(400, 'RESUME_INVALID_INPUT', 'Invalid resume data.');

    let authorId: string;
    try {
        authorId = await service.adminAuthor.ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'RESUME_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await service.authorWriter.saveResume(authorId, experiences, education);
    if (result.status === 'rejected') return apiError(400, 'RESUME_SAVE_FAILED', result.message);

    await logAdminActivity(
        request,
        platform,
        {
            action: 'resume.entries_update',
            category: 'resume',
            summary: `Saved ${experiences.length} experience and ${education.length} education entries.`
        },
        getClientAddress
    );

    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
