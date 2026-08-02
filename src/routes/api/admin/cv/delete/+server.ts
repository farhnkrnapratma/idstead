/** @format */

import type {RequestHandler} from './$types'
import {proxyToSupabaseEdgeFunction} from '$lib/supabaseFunctions'

export const POST: RequestHandler = async ({request}) => {
  return proxyToSupabaseEdgeFunction(request, 'admin-cv-delete')
}
