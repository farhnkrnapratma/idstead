import * as publicEnv from '$app/env/public';
import { supabase } from '#lib/supabase.ts';
import { fetchActiveCvDocument, fetchActiveOpenPgpKey, fetchSiteUrl } from '#lib/author.ts';
import { cvDocumentInfo } from '#lib/cvVerification.ts';

export async function loadPublicCvDocument(fetchFn: typeof fetch) {
    const [document, signingKey, siteUrl] = await Promise.all([
        fetchActiveCvDocument(supabase, fetchFn),
        fetchActiveOpenPgpKey(supabase),
        fetchSiteUrl(supabase)
    ]);
    if (!document?.fileUrl) return null;
    return cvDocumentInfo(
        document,
        signingKey && {
            fingerprint: signingKey.fingerprint,
            userIds: signingKey.userIds,
            keyservers: signingKey.keyservers
        },
        siteUrl,
        publicEnv.PUBLIC_API_BASE_URL
    );
}
