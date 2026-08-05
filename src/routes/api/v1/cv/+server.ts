/** @format */

import type {RequestHandler} from './$types'
import {supabase} from '$lib/supabase'
import {fetchActiveCvDocument} from '$lib/author'

export const GET: RequestHandler = async ({fetch, locals}) => {
  const supabaseClient = (locals as any)?.supabase || supabase
  const cvDoc = await fetchActiveCvDocument(supabaseClient)
  if (!cvDoc || !cvDoc.fileUrl) {
    return new Response('CV document not found', {status: 404})
  }

  const pdfUrl = cvDoc.fileUrl
  const filename = cvDoc.filename || 'cv.pdf'

  try {
    const response = await fetch(pdfUrl)
    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer()
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400'
        }
      })
    }
  } catch (err) {
    console.error('Failed to proxy CV PDF:', err)
  }

  return Response.redirect(pdfUrl, 302)
}
