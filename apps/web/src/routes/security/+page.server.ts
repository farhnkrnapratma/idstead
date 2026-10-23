import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { prepareMarkdownPage } from '@mdrs/core';
import { mdrsResolvers } from '#lib/server/mdrsData.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';

export const load: PageServerLoad = async ({ url }) => {
    const pageData = await getLegalPage('security');
    if (!pageData.content.trim()) error(404, 'Not found');
    const { html, headings } = await prepareMarkdownPage(
        pageData.content,
        mdrsResolvers(publicRepositories()),
        siteRenderOptions(url.origin)
    );

    return { pageData, html, headings };
};
