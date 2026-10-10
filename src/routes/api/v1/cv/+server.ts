import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { fetchActiveCvDocument } from '#lib/author.ts';
import { apiError } from '#lib/server/apiError.ts';

export const GET: RequestHandler = async ({ fetch, locals, url }) => {
    const supabaseClient = (locals as any)?.supabase || supabase;
    let cvDoc;
    try {
        cvDoc = await fetchActiveCvDocument(supabaseClient, fetch, { strict: true });
    } catch {
        return apiError(500, 'CV_METADATA_FETCH_FAILED', 'Could not fetch CV metadata.');
    }
    if (!cvDoc || !cvDoc.fileUrl) {
        return apiError(404, 'CV_DOCUMENT_NOT_FOUND', 'CV document not found.');
    }

    const pdfUrl = cvDoc.fileUrl;
    const filename = cvDoc.filename || 'cv.pdf';
    const checksum = cvDoc.hash || '';

    const wantsChecksum =
        url.searchParams.get('format') === 'sha256'
        || url.searchParams.get('checksum') === '1'
        || url.searchParams.get('checksum') === 'true';

    if (wantsChecksum) {
        const sha256Content = checksum ? `${checksum}  ${filename}\n` : '';
        return new Response(sha256Content, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}.sha256"`,
                'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
                'X-Checksum-SHA256': checksum
            }
        });
    }

    const forceDownload =
        url.searchParams.get('download') === '1' || url.searchParams.get('download') === 'true';
    const dispositionType = forceDownload ? 'attachment' : 'inline';

    try {
        const response = await fetch(pdfUrl);
        if (response.ok) {
            const pdfBuffer = await response.arrayBuffer();
            return new Response(pdfBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `${dispositionType}; filename="${filename}"`,
                    'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
                    'X-Checksum-SHA256': checksum
                }
            });
        }
    } catch (err) {
        console.error('Failed to proxy CV PDF:', err);
    }

    return apiError(502, 'CV_FETCH_FAILED', 'Failed to fetch CV file.');
};
