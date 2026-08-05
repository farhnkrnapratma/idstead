/** @format */

import {supabase} from '$lib/supabase'
import type {RequestHandler} from './$types'
import {proxyToSupabaseEdgeFunction} from '$lib/supabaseFunctions'

export const GET: RequestHandler = async ({request, url}) => {
  const target = new URL(request.url)
  target.search = url.search
  return proxyToSupabaseEdgeFunction(new Request(target, request), 'comments-api')
}

export const POST: RequestHandler = async ({request}) => {
  return proxyToSupabaseEdgeFunction(request, 'comments-api')
}
