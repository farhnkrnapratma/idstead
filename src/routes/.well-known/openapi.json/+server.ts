import type {RequestHandler} from './$types'
import {openapiSpec} from '$lib/openapi'

export const GET: RequestHandler = async () => {
  return new Response(JSON.stringify(openapiSpec, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
