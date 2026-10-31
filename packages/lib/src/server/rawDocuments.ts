import { publicRepositories } from './repositories';
import { mdrsResolvers } from './mdrsData';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { isValidPostSlug } from '@idstead/domain/slug.ts';
import { markdownToPlainText, resolveDefines } from '@mdrs/core';
import { siteContentLicense } from './siteLicense';
import {
    bannerCreditNotice,
    licenseNotice,
    resolvePostLicense
} from '@idstead/domain/contentLicense.ts';

export type DocumentFormat = 'md' | 'txt';

function documentResponse(body: string, format: DocumentFormat) {
    return new Response(body, {
        headers: {
            'Content-Type':
                format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
            'X-Robots-Tag': 'noindex'
        }
    });
}

function notFound() {
    return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

export async function blogDocument(slug: string, format: DocumentFormat, fetchFn: typeof fetch) {
    if (!isValidPostSlug(slug)) return notFound();
    const repositories = publicRepositories(fetchFn);
    const post = await repositories.blog.getPublishedBySlug(slug).catch(() => null);
    if (!post) return notFound();
    const markdown = (await repositories.blog.readMarkdown(post.source)) ?? '';
    const [body, siteLicense] = await Promise.all([
        markdown ?
            resolveDefines(markdown, mdrsResolvers(repositories))
        :   Promise.resolve(post.excerpt || ''),
        siteContentLicense(repositories)
    ]);
    const notice = [
        licenseNotice(resolvePostLicense(post.content_license, siteLicense)),
        post.banner_url ? bannerCreditNotice(post.banner_credit) : null
    ]
        .filter(Boolean)
        .join('\n\n');

    if (format === 'txt')
        return documentResponse(
            `${post.title}\n\n${post.excerpt ? `${post.excerpt}\n\n` : ''}${markdownToPlainText(body)}\n\n${notice}`,
            'txt'
        );
    return documentResponse(`# ${post.title}\n\n${body}\n\n---\n\n${notice}`, 'md');
}

export async function legalDocument(slug: string, format: DocumentFormat) {
    const page = await getLegalPage(slug);
    if (!page.content) return notFound();
    const content = await resolveDefines(page.content, mdrsResolvers(publicRepositories()));
    if (format === 'txt') {
        const text = markdownToPlainText(content);
        return documentResponse(page.title ? `${page.title}\n\n${text}` : text, 'txt');
    }
    return documentResponse(content, 'md');
}
