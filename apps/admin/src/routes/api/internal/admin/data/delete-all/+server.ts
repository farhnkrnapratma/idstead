import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { createSupabaseLoginLockoutStore } from '@idstead/data';
import { requireAdminAuth, deleteCvFile } from '#lib/server/adminCv.ts';
import { removeAssets, removeCanonicalIdentity } from '#lib/server/profileAssets.ts';
import { syncPostAssets } from '#lib/server/blogPostAssets.ts';
import { cleanupBlogAssets } from '#lib/server/blogBannerStorage.ts';
import {
    createSupabaseAdminAuthorStore,
    createSupabaseAdminPostStores,
    createSupabaseSiteDataStore
} from '@idstead/data';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { getSupabaseUserClient } from '#lib/server/supabaseUser.ts';
import {
    checkLoginLockout,
    clearLoginAttempts,
    recordFailedLogin
} from '#lib/server/loginRateLimit.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'DATA_STORAGE_UNAVAILABLE', 'Data storage is unavailable.');
    const lockoutStore = createSupabaseLoginLockoutStore(db);

    const token = bearerToken(request);
    const actorEmail = token ? (await db.auth.getUser(token)).data.user?.email : null;
    if (!actorEmail) return apiError(401, 'DATA_DELETE_AUTH_REQUIRED', 'Admin session is invalid.');

    const lockoutKey = `delete-all:${actorEmail}`;
    if (!(await checkLoginLockout(lockoutStore, '', lockoutKey)).allowed)
        return apiError(
            429,
            'DATA_DELETE_RATE_LIMITED',
            'Too many attempts. Try again in 15 minutes.'
        );

    let password = '';
    let captchaToken = '';
    try {
        const body = await request.json();
        if (typeof body?.password === 'string') password = body.password;
        if (typeof body?.captchaToken === 'string') captchaToken = body.captchaToken;
    } catch {
        password = '';
    }
    if (!password)
        return apiError(400, 'DATA_DELETE_PASSWORD_REQUIRED', 'Enter your password to confirm.');

    const verifier = getSupabaseUserClient(request, platform);
    if (!verifier) return apiError(503, 'DATA_STORAGE_UNAVAILABLE', 'Data storage is unavailable.');
    await recordFailedLogin(lockoutStore, '', lockoutKey);
    const { error: passwordError } = await verifier.auth.signInWithPassword({
        email: actorEmail,
        password,
        options: { captchaToken: captchaToken || undefined }
    });
    if (passwordError?.code === 'captcha_failed')
        return apiError(403, 'DATA_DELETE_TURNSTILE_FAILED', 'Verification challenge failed.');
    if (passwordError) return apiError(401, 'DATA_DELETE_PASSWORD_INVALID', 'Incorrect password.');
    await clearLoginAttempts(lockoutStore, '', lockoutKey);

    const siteData = createSupabaseSiteDataStore(db);
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
            db
        );

    let cleanupFailed = false;
    for (const filename of plan.documents) {
        if (!(await deleteCvFile(platform, db, filename, true))) cleanupFailed = true;
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
    const authorStore = createSupabaseAdminAuthorStore(db);
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

    const sweepPending = await cleanupBlogAssets(createSupabaseAdminPostStores(db), platform).then(
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

    return json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
};
