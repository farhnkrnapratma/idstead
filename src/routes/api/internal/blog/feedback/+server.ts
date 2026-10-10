import * as env from '$app/env/private';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { recordPageFeedback } from '#lib/server/pageFeedback.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, url, platform, getClientAddress }) =>
    recordPageFeedback({
        request,
        url,
        db: getSupabaseAdminClient(platform),
        ip: getClientAddress,
        secret: typeof platform?.env?.IP_SALT === 'string' ? platform.env.IP_SALT : env.IP_SALT,
        legacy: true
    });
