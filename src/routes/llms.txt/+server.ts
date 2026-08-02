/** @format */

import type {RequestHandler} from './$types'
import {supabase} from '$lib/supabase'
import {fetchAuthorProfile} from '$lib/author'

const SITE_URL = 'https://fkp.my.id'

export const GET: RequestHandler = async ({fetch}) => {
  const author = await fetchAuthorProfile(supabase)
  const authorName = author?.name || 'Author'
  const authorHeadline = author?.headline || 'Developer Portfolio'
  const authorBio = author?.bio || ''

  const {data: posts} = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, created_at')
    .eq('published', true)
    .order('created_at', {ascending: false})

  let md = `# ${authorName} — ${authorHeadline}

> ${authorBio}

Welcome to the LLM & AI Agent directory for ${authorName}'s developer portfolio. This file provides structured links to Markdown documents, public APIs, RSS feeds, and site documentation.

## Core Information & APIs

- [Author Profile Markdown](${SITE_URL}/api/author?format=md): Full author profile, technical skills, experiences, and contact channels in Markdown.
- [Public API Documentation](${SITE_URL}/api/README.md): Human-friendly documentation for REST & Markdown API endpoints.
- [OpenAPI (JSON)](${SITE_URL}/.well-known/openapi.json): Machine-readable OpenAPI v3 JSON specification for all public APIs.
- [OpenAPI (YAML)](${SITE_URL}/.well-known/openapi.yaml): Same spec in YAML format.
- [Atom RSS Feed](${SITE_URL}/atom.xml): Atom feed containing recent blog post summaries.
- [XML Sitemap](${SITE_URL}/sitemap.xml): Complete URL index for web crawlers.
- [CV Download PDF](${SITE_URL}/api/cv): Official curriculum vitae PDF file.

## Blog Posts (Markdown API)

`

  if (posts && posts.length > 0) {
    posts.forEach(post => {
      const dateStr = new Date(post.created_at).toISOString().split('T')[0]
      md += `- [${post.title}](${SITE_URL}/api/blog/${post.slug}?format=md): Published on ${dateStr}. ID: \`${post.id}\`. ${post.excerpt ? `— ${post.excerpt}` : ''}\n`
    })
  } else {
    md += `*No published posts available.*\n`
  }

  md += `\n## Optional & Additional Details\n\n`
  md += `- [JSON Author API](${SITE_URL}/api/author): Full author dataset in JSON format.\n`
  md += `- [JSON Blog Catalog](${SITE_URL}/api/blog): Catalog of published blog posts in JSON format.\n`

  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow'
    }
  })
}
