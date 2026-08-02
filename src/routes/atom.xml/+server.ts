/** @format */

import {supabase} from '$lib/supabase'
import type {RequestHandler} from './$types'

import {fetchAuthorProfile} from '$lib/author'

const SITE_URL = 'https://fkp.my.id'
const FEED_TITLE = 'fkp.my.id — Blog'

export const GET: RequestHandler = async ({fetch}) => {
  const authorProfile = await fetchAuthorProfile(supabase)
  const AUTHOR_NAME = authorProfile?.name || ''
  const AUTHOR_EMAIL = authorProfile?.email || 'contact@fkp.my.id'
  const FEED_SUBTITLE = authorProfile?.bio || ''

  const {data: posts} = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, created_at, storage_path')
    .eq('published', true)
    .order('created_at', {ascending: false})
    .limit(20)

  const enriched = await Promise.all(
    (posts ?? []).map(async post => {
      let content = post.excerpt ?? ''
      try {
        const {data: urlData} = supabase.storage
          .from('blog-posts')
          .getPublicUrl(post.storage_path)
        const fileRes = await fetch(urlData.publicUrl)
        if (fileRes.ok) {
          const md = await fileRes.text()
          content = md
            .replace(/^#{1,6}\s+.*/gm, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
            .replace(/[*_`~>#|-]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500)
          if (md.length > 500) content += '…'
        }
      } catch {
        content = post.excerpt ?? ''
      }
      return {...post, summary: content}
    })
  )

  const updatedDate =
    enriched.length > 0 ?
      new Date(enriched[0].created_at).toISOString()
    : new Date().toISOString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_SUBTITLE)}</subtitle>
  <link href="${SITE_URL}/atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${SITE_URL}/" rel="alternate" type="text/html"/>
  <id>${SITE_URL}/</id>
  <updated>${updatedDate}</updated>
  <author>
    <name>${escapeXml(AUTHOR_NAME)}</name>
    <email>${escapeXml(AUTHOR_EMAIL)}</email>
    <uri>${SITE_URL}/</uri>
  </author>
  <generator uri="https://kit.svelte.dev" version="2.0">SvelteKit</generator>
  <rights>© ${new Date().getFullYear()} ${escapeXml(AUTHOR_NAME)}. All rights reserved.</rights>
${enriched
  .map(
    post => `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${SITE_URL}/blog/${escapeXml(post.slug)}" rel="alternate" type="text/html"/>
    <link href="${SITE_URL}/api/blog/${escapeXml(post.slug)}?format=md" rel="alternate" type="text/markdown"/>
    <id>urn:uuid:${post.id}</id>
    <published>${new Date(post.created_at).toISOString()}</published>
    <updated>${new Date(post.created_at).toISOString()}</updated>
    <author>
      <name>${escapeXml(AUTHOR_NAME)}</name>
    </author>
    <summary type="text">${escapeXml(post.summary)}</summary>
  </entry>`
  )
  .join('\n')}
</feed>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800'
    }
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
