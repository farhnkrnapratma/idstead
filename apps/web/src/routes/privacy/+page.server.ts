import type { PageServerLoad } from './$types';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { prepareMarkdownPage } from '@mdrs/core';
import { createSupabaseMdrsResolvers } from '#lib/server/mdrsData.ts';
import { supabase } from '#lib/supabase.ts';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';

export const load: PageServerLoad = async ({ url }) => {
    const pageData = await getLegalPage('privacy');
    const { html, headings } = await prepareMarkdownPage(
        pageData.content,
        createSupabaseMdrsResolvers(supabase),
        siteRenderOptions(url.origin)
    );

    return { pageData, html, headings };
};
