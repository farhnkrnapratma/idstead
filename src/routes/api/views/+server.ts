/** @format */

import {supabase} from '$lib/supabase'
import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'

export const POST: RequestHandler = async ({request, getClientAddress}) => {
  try {
    const {post_id} = await request.json()
    if (!post_id || typeof post_id !== 'string') {
      return json({error: 'Invalid post_id'}, {status: 400})
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
      .eq('post_id', post_id)
      .eq('ip_hash', dailyKey)
      .maybeSingle()

    if (existing) {
      return json({counted: false})
    }

    await supabase
      .from('post_views')
      .insert({post_id, ip_hash: dailyKey, viewed_at: new Date().toISOString()})

    return json({counted: true})
  } catch (err) {
    console.error('View tracking error:', err)
    return json({error: 'Internal error'}, {status: 500})
  }
}

export const GET: RequestHandler = async ({url}) => {
  const post_id = url.searchParams.get('post_id')
  if (!post_id) {
    return json({error: 'Missing post_id'}, {status: 400})
  }

  const {count} = await supabase
    .from('post_views')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', post_id)

  return json({views: count ?? 0})
}
