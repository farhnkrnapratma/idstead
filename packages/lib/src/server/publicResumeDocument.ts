// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as publicEnv from '$app/env/public';
import { resumeDocumentInfo } from '#lib/resumeVerification.ts';
import { publicRepositories } from './repositories';

export async function loadPublicResumeDocument(fetchFn: typeof fetch) {
    const { author } = publicRepositories(fetchFn);
    const [document, signingKey, siteUrl] = await Promise.all([
        author.activeResumeDocument().catch(() => null),
        author.activeOpenPgpKey().catch(() => null),
        author.siteUrl().catch(() => '')
    ]);
    if (!document?.fileUrl) return null;
    return resumeDocumentInfo(
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
