import type { PageServerLoad } from './$types';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { prepareMarkdownPage } from '@mdrs/core';
import { createSupabaseMdrsResolvers } from '#lib/server/mdrsData.ts';
import { supabase } from '#lib/supabase.ts';

export const load: PageServerLoad = async () => {
    const pageData = await getLegalPage('security');
    const { html, headings } = await prepareMarkdownPage(
        pageData.content,
        createSupabaseMdrsResolvers(supabase)
    );

    return { pageData, html, headings };
};
