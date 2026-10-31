import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { buildDataExport } from '#lib/server/dataExport.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'DATA_STORAGE_UNAVAILABLE',
        message: 'Data storage is unavailable.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    const { zip, stamp, warnings } = await buildDataExport(
        service,
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
