/** @format */

import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'
import {supabase} from '$lib/supabase'
import {fetchGroupedSkills} from '$lib/author'
import {sanitizePublicApiData} from '$lib/authorApi'

export const GET: RequestHandler = async ({locals}) => {
  const supabaseClient = (locals as any)?.supabase || supabase
  const rawSkills = await fetchGroupedSkills(supabaseClient)
  const skills = sanitizePublicApiData(rawSkills)
  return json(skills, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow'
    }
  })
}
