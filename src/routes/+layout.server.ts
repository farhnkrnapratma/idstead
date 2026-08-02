/** @format */

import type {LayoutServerLoad} from './$types'
import {supabase} from '$lib/supabase'
import {fetchAuthorProfile} from '$lib/author'

export const load: LayoutServerLoad = async () => {
  const author = await fetchAuthorProfile(supabase)
  return {author}
}
