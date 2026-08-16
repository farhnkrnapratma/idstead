import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'
import {supabase} from '$lib/supabase'
import {fetchFundingLinks} from '$lib/author'
import {sanitizePublicApiData} from '$lib/authorApi'

export const GET: RequestHandler = async ({locals}) => {
  const supabaseClient = (locals as any)?.supabase || supabase
  const rawFunding = await fetchFundingLinks(supabaseClient)
  const funding = sanitizePublicApiData(rawFunding)
  return json(funding, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow'
    }
  })
}
