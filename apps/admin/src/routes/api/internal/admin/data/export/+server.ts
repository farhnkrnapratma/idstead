import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { buildDataExport } from '#lib/server/dataExport.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'DATA_STORAGE_UNAVAILABLE', 'Data storage is unavailable.');

    const { zip, stamp, warnings } = await buildDataExport(
        db,
        platform,
        url.searchParams.get('stamp')
    );
    return new Response(zip as BodyInit, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="data-export_${stamp}.zip"`,
            'X-Export-Warnings': String(warnings.length),
            'Cache-Control': 'no-store'
        }
    });
};
