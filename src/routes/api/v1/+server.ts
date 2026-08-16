import type {RequestHandler} from './$types'

import readme from './README.md?raw'

export const GET: RequestHandler = async () => {
  return new Response(readme, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
