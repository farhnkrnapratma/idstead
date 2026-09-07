import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {fetchActiveCvDocument} from '$lib/author';
import {apiError} from '$lib/server/apiError';

export const GET: RequestHandler = async ({fetch, locals, url}) => {
  const supabaseClient = (locals as any)?.supabase || supabase;
  const cvDoc = await fetchActiveCvDocument(supabaseClient, fetch);
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
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Checksum-SHA256': checksum
      }
    });
  }

  const forceDownload =
    url.searchParams.get('download') === '1'
    || url.searchParams.get('download') === 'true';
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
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'X-Checksum-SHA256': checksum
        }
      });
    }
  } catch (err) {
    console.error('Failed to proxy CV PDF:', err);
  }

  return apiError(502, 'CV_FETCH_FAILED', 'Failed to fetch CV file.');
};
