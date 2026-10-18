import type { PageServerLoad } from './$types';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { prepareMarkdownPage } from '@fkp/mdrs';
import { createMdrsResolvers } from '#lib/mdrsResolvers.ts';
import { supabase } from '#lib/supabase.ts';

export const load: PageServerLoad = async () => {
    const pageData = await getLegalPage('terms');
    const { html, headings } = await prepareMarkdownPage(
        pageData.content,
        createMdrsResolvers(supabase)
    );

    return { pageData, html, headings };
};
