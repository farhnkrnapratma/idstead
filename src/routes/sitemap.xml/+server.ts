import {supabase} from '$lib/supabase'
import type {RequestHandler} from './$types'

const SITE_URL = 'https://fkp.my.id'

export const GET: RequestHandler = async () => {
  const {data: posts} = await supabase
    .from('db_posts')
    .select('slug, created_at, title')
    .eq('published', true)
    .order('created_at', {ascending: false})

  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastmod: new Date().toISOString().split('T')[0],
      priority: '1.0',
      changefreq: 'weekly'
    },
    {
      url: `${SITE_URL}/feedback`,
      lastmod: new Date().toISOString().split('T')[0],
      priority: '0.5',
      changefreq: 'monthly'
    },
    {
      url: `${SITE_URL}/privacy`,
      lastmod: new Date().toISOString().split('T')[0],
      priority: '0.5',
      changefreq: 'monthly'
    }
  ]

  const postRoutes = (posts ?? []).map(post => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastmod: new Date(post.created_at).toISOString().split('T')[0],
    priority: '0.8',
    changefreq: 'monthly'
  }))

  const allRoutes = [...staticRoutes, ...postRoutes]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allRoutes
  .map(
    route => `  <url>
    <loc>${escapeXml(route.url)}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
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
