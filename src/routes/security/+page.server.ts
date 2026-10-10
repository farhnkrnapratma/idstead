import type { PageServerLoad } from './$types';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { prepareMarkdownPage } from '#lib/markdown.ts';
import { supabase } from '#lib/supabase.ts';

export const load: PageServerLoad = async () => {
    const pageData = await getLegalPage('security');
    const { html, headings } = await prepareMarkdownPage(pageData.content, supabase);

    return { pageData, html, headings };
};
