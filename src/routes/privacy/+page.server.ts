import type {PageServerLoad} from './$types';
import {getLegalPage} from '$lib/server/legalPages';
import {prepareMarkdownPage} from '$lib/markdown';
import {supabase} from '$lib/supabase';

export const load: PageServerLoad = async () => {
  const pageData = await getLegalPage('privacy');
  const {html, headings} = await prepareMarkdownPage(
    pageData.content,
    supabase
  );

  return {pageData, html, headings};
};
