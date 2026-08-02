/** @format */

import {supabase} from '$lib/supabase'
import {error} from '@sveltejs/kit'
import {renderMarkdown} from '$lib/markdown'
import type {PageServerLoad} from './$types'
import {fetchAuthorProfile} from '$lib/author'

export interface BlogComment {
  id: string
  post_id: string
  parent_id: string | null
  author_name: string
  content: string
  is_anonymous?: boolean
  is_approved: boolean
  created_at: string
}

function injectHeadingIds(html: string): string {
  let index = 0
  const usedIds = new Set<string>()

  return html.replace(
    /<h([23])([^>]*)>(.*?)<\/h\1>/gi,
    (match, level, attrs, content) => {
      if (attrs.includes('id=')) {
        const idMatch = attrs.match(/id="([^"]*)"/)
        if (idMatch) {
          usedIds.add(idMatch[1])
        }
        return match
      }

      const text = content.replace(/<[^>]*>/g, '')
      const baseId =
        text ?
          text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
        : `heading-${index++}`

      let id = baseId
      let counter = 1
      while (usedIds.has(id)) {
        id = `${baseId}-${counter++}`
      }
      usedIds.add(id)

      return `<h${level}${attrs} id="${id}">${content}</h${level}>`
    }
  )
}

function estimateReadTime(markdown: string): string {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min${minutes > 1 ? 's' : ''} read`
}

export const load: PageServerLoad = async ({params, fetch}) => {
  const {slug} = params

  let post
  try {
    const {data, error: postError} = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .single()

    if (postError || !data) {
      console.error(`Post not found: ${slug}`, postError)
      throw error(404, 'Blog post not found')
    }
    post = data
  } catch (err: unknown) {
    const errorObj = err as {status?: number}
    if (errorObj && errorObj.status) throw err
    console.error(`Database error fetching post: ${slug}`, err)
    throw error(500, 'Internal Server Error: Could not retrieve post.')
  }

  let html: string
  let readTime = '1 min read'
  try {
    const {data} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(post.storage_path)
    const fileRes = await fetch(data.publicUrl)
    if (!fileRes.ok) {
      throw new Error(`Failed to fetch markdown file: ${fileRes.statusText}`)
    }
    const markdown = await fileRes.text()
    readTime = estimateReadTime(markdown)
    const rawHtml = await renderMarkdown(markdown)
    html = injectHeadingIds(rawHtml)
  } catch (err) {
    console.error('Error fetching/rendering markdown file:', err)
    html = '<p class="text-red-500">Error: Could not render post content.</p>'
  }

  function decodeHtmlEntities(str: string): string {
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }

  interface HeadingItem {
    id: string
    text: string
    level: number
  }
  const headings: HeadingItem[] = []
  const headingRegex = /<h([23])\s+[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi
  let match
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = decodeHtmlEntities(match[3].trim())
    headings.push({id, text, level})
  }

  let comments: BlogComment[] = []
  try {
    const {data, error: commentsError} = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .eq('is_approved', true)
      .order('created_at', {ascending: true})

    if (commentsError) {
      console.error('Error fetching comments:', commentsError)
    } else {
      comments = data || []
    }
  } catch (err) {
    console.error('Database error fetching comments:', err)
  }

  let bannerPublicUrl: string | null = null
  if (post.banner_path) {
    const {data: bannerRes} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(post.banner_path)
    bannerPublicUrl = bannerRes?.publicUrl || null
  }

  const author = await fetchAuthorProfile(supabase)

  return {
    post: {...post, read_time: readTime},
    bannerPublicUrl,
    html,
    headings,
    comments,
    author
  }
}
