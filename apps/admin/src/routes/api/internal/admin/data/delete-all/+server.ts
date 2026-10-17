import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth, deleteCvFile } from '#lib/server/adminCv.ts';
import { removeAssets, removeCanonicalIdentity } from '#lib/server/profileAssets.ts';
import { syncPostAssets } from '#lib/server/blogPostAssets.ts';
import { cleanupBlogAssets } from '#lib/server/blogBannerStorage.ts';
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
        return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'DATA_STORAGE_UNAVAILABLE', 'Data storage is unavailable.');

    const token = bearerToken(request);
    const actorEmail = token ? (await db.auth.getUser(token)).data.user?.email : null;
    if (!actorEmail) return apiError(401, 'DATA_DELETE_AUTH_REQUIRED', 'Admin session is invalid.');

    const lockoutKey = `delete-all:${actorEmail}`;
    if (!(await checkLoginLockout(db, '', lockoutKey)).allowed)
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
    await recordFailedLogin(db, '', lockoutKey);
    const { error: passwordError } = await verifier.auth.signInWithPassword({
        email: actorEmail,
        password,
        options: { captchaToken: captchaToken || undefined }
    });
    if (passwordError?.code === 'captcha_failed')
        return apiError(403, 'DATA_DELETE_TURNSTILE_FAILED', 'Verification challenge failed.');
    if (passwordError) return apiError(401, 'DATA_DELETE_PASSWORD_INVALID', 'Incorrect password.');
    await clearLoginAttempts(db, '', lockoutKey);

    const { data: profile } = await db.from('db_profiles').select('id').limit(1).maybeSingle();

    let documents: { filename: string }[] = [];
    let identityVersions: { id: string }[] = [];
    if (profile?.id) {
        const [
            { data: documentsData, error: documentsError },
            { data: versionsData, error: versionsError }
        ] = await Promise.all([
            db.from('db_documents').select('filename').eq('author_id', profile.id),
            db.from('db_identity_versions').select('id').eq('profile_id', profile.id)
        ]);
        if (documentsError || versionsError)
            return apiError(
                503,
                'DATA_DELETE_FAILED',
                'Could not load profile files. No data was deleted.'
            );
        documents = documentsData ?? [];
        identityVersions = versionsData ?? [];
    }

    const { data: postRows, error: postError } = await db
        .from('db_posts')
        .select('id, slug, published');
    if (postError)
        return apiError(503, 'DATA_DELETE_FAILED', 'Could not load posts. No data was deleted.');

    let cleanupFailed = false;
    for (const doc of documents) {
        if (doc.filename && !(await deleteCvFile(platform, db, doc.filename, true)))
            cleanupFailed = true;
    }
    try {
        await removeCanonicalIdentity(platform);
    } catch (error) {
        cleanupFailed = true;
        console.error('Identity asset cleanup failed:', error);
    }
    for (const post of postRows ?? []) {
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
    for (const version of identityVersions) {
        try {
            await removeAssets(platform, version.id);
            const { error: deleteError } = await db
                .from('db_identity_versions')
                .delete()
                .eq('id', version.id);
            if (deleteError) cleanupFailed = true;
        } catch (error) {
            cleanupFailed = true;
            console.error('Identity asset cleanup failed:', error);
        }
    }
    if (cleanupFailed)
        return apiError(
            503,
            'DATA_DELETE_CLEANUP_FAILED',
            'Some uploaded files could not be removed, so site data was not cleared. Try again.'
        );

    const { error } = await db.rpc('db_clear_all_data');
    if (error) return apiError(503, 'DATA_DELETE_FAILED', 'Could not clear site data.');

    const sweepPending = await cleanupBlogAssets(db, platform).then(
        ({ cleanupPending }) => cleanupPending,
        error => {
            console.error('Blog asset cleanup failed:', error);
            return true;
        }
    );

    await logActivity(
        {
            actor: actorEmail,
            action: 'data.delete_all',
            category: 'security',
            summary:
                sweepPending ?
                    'Deleted all site data; some blog files still need cleanup.'
                :   'Deleted all site data.',
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
