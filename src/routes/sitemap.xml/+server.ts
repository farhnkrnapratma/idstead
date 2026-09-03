import {supabase} from '$lib/supabase';
import type {RequestHandler} from './$types';
import {fetchAuthorProfile} from '$lib/author';
import {escapeXml} from '$lib/utils/xml';

export const GET: RequestHandler = async () => {
  const [authorProfile, {data: posts}] = await Promise.all([
    fetchAuthorProfile(supabase),
    supabase
      .from('db_posts')
      .select('slug, created_at, updated_at, title')
      .eq('published', true)
      .order('created_at', {ascending: false})
  ]);

  const SITE_URL = (authorProfile?.siteUrl || '').replace(/\/$/, '');

  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastmod: '2026-08-30',
      priority: '1.0',
      changefreq: 'weekly'
    },
    {
      url: `${SITE_URL}/feedback`,
      lastmod: '2026-08-30',
      priority: '0.5',
      changefreq: 'monthly'
    },
    {
      url: `${SITE_URL}/privacy`,
      lastmod: '2026-08-30',
      priority: '0.5',
      changefreq: 'monthly'
    },
    {
      url: `${SITE_URL}/terms`,
      lastmod: '2026-08-30',
      priority: '0.5',
      changefreq: 'monthly'
    },
    {
      url: `${SITE_URL}/security`,
      lastmod: '2026-08-30',
      priority: '0.5',
      changefreq: 'monthly'
    }
  ];

  const postRoutes = (posts ?? []).map(post => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastmod:
      post.updated_at ?
        new Date(post.updated_at).toISOString().split('T')[0]
      : new Date(post.created_at).toISOString().split('T')[0],
    priority: '0.8',
    changefreq: 'monthly'
  }));

  const allRoutes = [...staticRoutes, ...postRoutes];

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
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
};
