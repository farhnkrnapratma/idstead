import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { recordPageFeedback } from '#lib/server/pageFeedback.ts';
import type { RequestHandler } from './$types';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = ({ request, url, platform, getClientAddress }) =>
    recordPageFeedback({
        request,
        url,
        db: getSupabaseAdminClient(platform),
        ip: getClientAddress,
        secret: ipSalt(platform)
    });
