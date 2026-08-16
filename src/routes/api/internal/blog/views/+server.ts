import {supabase} from '$lib/supabase'
import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'
import {apiError} from '$lib/server/apiError'
import {isSameOriginRequest} from '$lib/server/sameOrigin'

export const POST: RequestHandler = async ({
  request,
  url,
  getClientAddress,
  platform
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    )
  }

  try {
    const body = await request.json()
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
    if (!postId) {
      return apiError(400, 'BLOG_VIEW_POST_ID_REQUIRED', 'postId is required.')
    }

    const ip = getClientAddress()

    const ipSalt =
      (platform as unknown as {env?: {IP_SALT?: string}})?.env?.IP_SALT
      ?? process.env.IP_SALT
      ?? 'fkp-views-salt'
    const ipHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ip + ipSalt)
    )
    const ipHash = Array.from(new Uint8Array(ipHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const today = new Date().toISOString().split('T')[0]
    const dailyKey = `${today}_${ipHash}`

    const {data: existing} = await supabase
      .from('db_views')
      .select('id')
      .eq('post_id', postId)
      .eq('ip_hash', dailyKey)
      .maybeSingle()

    if (existing) {
      return json({counted: false})
    }

    await supabase
      .from('db_views')
      .insert({
        post_id: postId,
        ip_hash: dailyKey,
        viewed_at: new Date().toISOString()
      })

    return json({counted: true}, {status: 201})
  } catch (err) {
    console.error('View tracking error:', err)
    return apiError(
      500,
      'BLOG_VIEW_TRACKING_FAILED',
      'An unexpected error occurred while recording views.'
    )
  }
}
