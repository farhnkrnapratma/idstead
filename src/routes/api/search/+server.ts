/** @format */

import {supabase} from '$lib/supabase'
import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'

export interface SearchResult {
  type: 'post' | 'project'
  title: string
  subtitle: string
  url: string
  tags?: string[]
}

export const GET: RequestHandler = async ({url}) => {
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return json({results: []})
  }

  const results: SearchResult[] = []

  const {data: posts, error: postsError} = await supabase
    .from('posts')
    .select('id, title, slug, excerpt')
    .eq('published', true)
    .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`)
    .order('created_at', {ascending: false})
    .limit(6)

  if (!postsError && posts) {
    for (const post of posts) {
      results.push({
        type: 'post',
        title: post.title,
        subtitle: post.excerpt ?? 'Blog post',
        url: `/blog/${post.slug}`
      })
    }
  }

  return json({results})
}
