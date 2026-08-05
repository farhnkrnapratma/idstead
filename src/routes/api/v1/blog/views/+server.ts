/** @format */

import {supabase} from '$lib/supabase'
import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'

export const POST: RequestHandler = async ({request, getClientAddress}) => {
  try {
    const body = await request.json()
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
    if (!postId) {
      return json(
        {
          code: 400,
          error: '400 Bad Request: postId is required.'
        },
        {status: 400}
      )
    }

    const ip = getClientAddress()
    const ipHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ip + (process.env.IP_SALT ?? 'fkp-views-salt'))
    )
    const ipHash = Array.from(new Uint8Array(ipHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const today = new Date().toISOString().split('T')[0]
    const dailyKey = `${today}_${ipHash}`

    const {data: existing} = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('ip_hash', dailyKey)
      .maybeSingle()

    if (existing) {
      return json({counted: false})
    }

    await supabase
      .from('post_views')
      .insert({post_id: postId, ip_hash: dailyKey, viewed_at: new Date().toISOString()})

    return json({counted: true})
  } catch (err) {
    console.error('View tracking error:', err)
    return json(
      {
        code: 500,
        error:
          '500 Internal Server Error: An unexpected error occurred while recording views.'
      },
      {status: 500}
    )
  }
}

export const GET: RequestHandler = async ({url}) => {
  const postId = url.searchParams.get('postId')?.trim() || ''
  if (!postId) {
    return json(
      {
        code: 400,
        error: '400 Bad Request: postId is required.'
      },
      {status: 400}
    )
  }

  const {count} = await supabase
    .from('post_views')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', postId)

  return json({postId, views: count ?? 0})
}
