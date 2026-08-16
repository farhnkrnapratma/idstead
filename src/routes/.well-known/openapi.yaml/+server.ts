import type {RequestHandler} from './$types'
import {stringify} from 'yaml'
import {openapiSpec} from '$lib/openapi'

export const GET: RequestHandler = async () => {
  return new Response(stringify(openapiSpec), {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
