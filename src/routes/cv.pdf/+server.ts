/** @format */

import type {RequestHandler} from './$types'

export const GET: RequestHandler = async () => {
  return new Response('CV PDF document coming soon.', {
    status: 200,
    headers: {'Content-Type': 'text/plain; charset=utf-8'}
  })
}
