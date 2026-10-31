import { error } from '@sveltejs/kit';
import { prepareMarkdownPage } from '@mdrs/core';
import type { LegalSlug } from '@idstead/domain/legal.ts';
import type { LegalPageData } from '../legalDefaults';
import { siteRenderOptions } from '../mdrsOptions';
import { mdrsResolvers } from './mdrsData';
import { publicRepositories } from './repositories';

export type { LegalPageData };

export async function getLegalPage(slug: string): Promise<LegalPageData> {
    try {
        const page = await publicRepositories().legal.page(slug);
        return page ?? { slug, title: '', content: '' };
    } catch {
        return { slug, title: '', content: '' };
    }
}

export async function loadLegalPage(slug: LegalSlug, origin: string) {
    const pageData = await getLegalPage(slug);
    if (!pageData.content.trim()) error(404, 'Not found');
    const { html, headings } = await prepareMarkdownPage(
        pageData.content,
        mdrsResolvers(publicRepositories()),
        siteRenderOptions(origin)
    );
    return { pageData, html, headings };
}
