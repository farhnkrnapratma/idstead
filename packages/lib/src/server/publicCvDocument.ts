import * as publicEnv from '$app/env/public';
import { cvDocumentInfo } from '#lib/cvVerification.ts';
import { publicRepositories } from './repositories';

export async function loadPublicCvDocument(fetchFn: typeof fetch) {
    const { author } = publicRepositories(fetchFn);
    const [document, signingKey, siteUrl] = await Promise.all([
        author.activeCvDocument().catch(() => null),
        author.activeOpenPgpKey().catch(() => null),
        author.siteUrl().catch(() => '')
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
