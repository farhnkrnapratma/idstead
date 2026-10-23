import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { publicRepositories } from '#lib/server/repositories.ts';
import {
    readSite,
    readPublishedPosts,
    validDate,
    publicResponse
} from '#lib/server/publicMetadata.ts';
import { escapeXml as xml } from '@idstead/domain/xml.ts';
import { publishedLegalSlugs } from '@idstead/domain/legal.ts';

export const GET: RequestHandler = async ({ request, fetch, platform }) => {
    const [{ siteUrl, profile }, posts, legal] = await Promise.all([
        readSite(platform),
        readPublishedPosts(),
        publicRepositories(fetch)
            .legal.pages()
            .catch(() => null)
    ]);
    if (!legal) error(503, 'Sitemap is temporarily unavailable.');
    const routes =
        !profile ?
            []
        :   [
                { path: '/', updated: undefined as string | undefined },
                { path: '/projects', updated: undefined as string | undefined },
                { path: '/blog', updated: undefined as string | undefined },
                { path: '/cv', updated: undefined as string | undefined },
                { path: '/funding', updated: undefined as string | undefined },
                { path: '/contact', updated: undefined as string | undefined },
                { path: '/feedback', updated: undefined as string | undefined },
                ...legal
                    .filter(page => publishedLegalSlugs([page]).length > 0)
                    .map(page => ({ path: '/' + page.slug, updated: validDate(page.updated_at) })),
                ...posts.map(post => ({
                    path: '/blog/' + encodeURIComponent(post.slug),
                    updated: validDate(post.updated_at) ?? validDate(post.created_at)
                }))
            ];
    const entries = routes.map(
        route =>
            `<url><loc>${xml(siteUrl + route.path)}</loc>${route.updated ? `<lastmod>${route.updated}</lastmod>` : ''}</url>`
    );
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > Math.ceil(entries.length / 10000))
        error(404, 'Sitemap page not found.');
    const body =
        entries.length > 10000 && page === 0 ?
            `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: Math.ceil(entries.length / 10000) }, (_, i) => `<sitemap><loc>${xml(siteUrl + '/sitemap.xml?page=' + (i + 1))}</loc></sitemap>`).join('')}</sitemapindex>`
        :   `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(page ? entries.slice((page - 1) * 10000, page * 10000) : entries).join('\n')}</urlset>`;
    return publicResponse(
        request,
        '<?xml version="1.0" encoding="UTF-8"?>\n' + body,
        'application/xml; charset=utf-8',
        300
    );
};
