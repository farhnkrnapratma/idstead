import * as publicEnv from '$app/env/public';
import { supabase } from '#lib/supabase.ts';
import {
    fetchActiveCvDocument,
    fetchActiveOpenPgpKey,
    fetchCvEntries,
    fetchGroupedSkills
} from '#lib/author.ts';
import { cvDocumentInfo } from '#lib/cvVerification.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, parent }) => {
    const [{ author }, cv, skills, cvDocument, signingKey] = await Promise.all([
        parent(),
        fetchCvEntries(supabase),
        fetchGroupedSkills(supabase),
        fetchActiveCvDocument(supabase, fetch),
        fetchActiveOpenPgpKey(supabase)
    ]);
    return {
        cv,
        skills,
        cvDocument:
            cvDocument?.fileUrl ?
                cvDocumentInfo(
                    cvDocument,
                    signingKey && {
                        fingerprint: signingKey.fingerprint,
                        userIds: signingKey.userIds,
                        keyservers: signingKey.keyservers
                    },
                    author?.siteUrl || '',
                    publicEnv.PUBLIC_API_BASE_URL
                )
            :   null
    };
};
