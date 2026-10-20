import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { getSupabaseUserClient } from '#lib/server/supabaseUser.ts';
import { adminActivity } from '#lib/server/adminActivity.ts';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ request, url, platform }) =>
    adminActivity(
        {
            request,
            url,
            db: getSupabaseAdminClient(platform),
            sessionDb: getSupabaseUserClient(request, platform)
        },
        false
    );
