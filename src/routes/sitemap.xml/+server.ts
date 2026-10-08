import type {RequestHandler} from './$types';
import {error} from '@sveltejs/kit';
import {supabase} from '#lib/supabase.ts';
import {
  readSiteProfile,
  readPublishedPosts,
  validDate,
  publicResponse
} from '#lib/server/publicMetadata.ts';
import {escapeXml as xml} from '#lib/utils/xml.ts';

export const GET: RequestHandler = async ({request}) => {
  const [profile, posts, {data: legal, error: failure}] = await Promise.all([
    readSiteProfile(),
    readPublishedPosts(),
    supabase.from('db_legals').select('slug,updated_at')
  ]);
  if (failure) error(503, 'Sitemap is temporarily unavailable.');
  const routes = [
    {path: '/', updated: undefined as string | undefined},
    {path: '/feedback', updated: undefined as string | undefined},
    ...(legal ?? [])
      .filter(page => ['privacy', 'terms', 'security'].includes(page.slug))
      .map(page => ({
        path: '/' + page.slug,
        updated: validDate(page.updated_at)
      })),
    ...posts.map(post => ({
      path: '/blog/' + encodeURIComponent(post.slug),
      updated: validDate(post.updated_at) ?? validDate(post.created_at)
    }))
  ];
  const entries = routes.map(
    route =>
      `<url><loc>${xml(profile.siteUrl + route.path)}</loc>${route.updated ? `<lastmod>${route.updated}</lastmod>` : ''}</url>`
  );
  const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
  if (
    !Number.isInteger(page)
    || page < 0
    || page > Math.ceil(entries.length / 10000)
  )
    error(404, 'Sitemap page not found.');
  const body =
    entries.length > 10000 && page === 0 ?
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({length: Math.ceil(entries.length / 10000)}, (_, i) => `<sitemap><loc>${xml(profile.siteUrl + '/sitemap.xml?page=' + (i + 1))}</loc></sitemap>`).join('')}</sitemapindex>`
    : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(page ? entries.slice((page - 1) * 10000, page * 10000) : entries).join('\n')}</urlset>`;
  return publicResponse(
    request,
    '<?xml version="1.0" encoding="UTF-8"?>\n' + body,
    'application/xml; charset=utf-8',
    300
  );
};
