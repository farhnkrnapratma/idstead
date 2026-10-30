import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { dataStores } from '#lib/server/data.ts';
import { deleteResumeFile } from '#lib/server/adminResume.ts';
import { verifyAdminRequest } from '#lib/server/adminAuth.ts';
import { removeAssets, removeCanonicalIdentity } from '#lib/server/profileAssets.ts';
import { syncPostAssets } from '#lib/server/blogPostAssets.ts';
import { cleanupBlogAssets } from '#lib/server/blogBannerStorage.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

const REAUTH_SECONDS = 600;

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const auth = await verifyAdminRequest(request, platform);
    if (auth.status) return apiError(auth.status, 'ADMIN_AUTH_REQUIRED', auth.message);
    const service = dataStores(platform).service;
    if (!service) return apiError(503, 'DATA_STORAGE_UNAVAILABLE', 'Data storage is unavailable.');
    const actorEmail = auth.actor;

    let confirmation = '';
    try {
        const body = await request.json();
        if (typeof body?.confirm === 'string') confirmation = body.confirm;
    } catch {
        confirmation = '';
    }
    if (confirmation !== 'DELETE')
        return apiError(400, 'DATA_DELETE_CONFIRMATION_REQUIRED', 'Type DELETE to confirm.');
    if (Math.floor(Date.now() / 1000) - auth.authTime > REAUTH_SECONDS)
        return apiError(
            403,
            'ADMIN_REAUTH_REQUIRED',
            'Sign out and sign in again within the last 10 minutes to delete all data.'
        );

    const siteData = service.siteData;
    let plan;
    try {
        plan = await siteData.deletionPlan();
    } catch {
        return apiError(
            503,
            'DATA_DELETE_FAILED',
            'Could not load profile files and posts. No data was deleted.'
        );
    }

    const audit = (summary: string) =>
        logActivity(
            {
                actor: actorEmail,
                action: 'data.delete_all',
                category: 'security',
                summary,
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

    let cleanupFailed = false;
    for (const filename of plan.documents) {
        if (!(await deleteResumeFile(platform, service.resumeDocuments, filename, true)))
            cleanupFailed = true;
    }
    try {
        await removeCanonicalIdentity(platform);
    } catch (error) {
        cleanupFailed = true;
        console.error('Identity asset cleanup failed:', error);
    }
    for (const post of plan.posts) {
        try {
            await syncPostAssets({
                platform,
                cdnBase: '',
                markdown: null,
                post,
                previous: post,
                deleted: true
            });
        } catch (error) {
            cleanupFailed = true;
            console.error('Blog asset cleanup failed:', error);
        }
    }
    const authorStore = service.adminAuthor;
    for (const version of plan.identityVersions) {
        try {
            await removeAssets(platform, version);
            await authorStore.deleteIdentityVersion(version);
        } catch (error) {
            cleanupFailed = true;
            console.error('Identity asset cleanup failed:', error);
        }
    }
    if (cleanupFailed) {
        await audit('Delete all stopped: some uploaded files could not be removed.');
        return apiError(
            503,
            'DATA_DELETE_CLEANUP_FAILED',
            'Some uploaded files could not be removed and site data was not cleared yet. Files that were removed stay removed; try again to finish.'
        );
    }

    try {
        await siteData.clearAll();
    } catch {
        await audit(
            'Delete all stopped: uploaded files were removed but site data was not cleared.'
        );
        return apiError(
            503,
            'DATA_DELETE_FAILED',
            'Uploaded files were removed, but site data could not be cleared. Try again to finish.'
        );
    }

    const sweepPending = await cleanupBlogAssets(service.adminPosts, platform).then(
        ({ cleanupPending }) => cleanupPending,
        error => {
            console.error('Blog asset cleanup failed:', error);
            return true;
        }
    );

    await audit(
        sweepPending ?
            'Deleted all site data; some blog files still need cleanup.'
        :   'Deleted all site data.'
    );

    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
