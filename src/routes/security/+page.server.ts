import type {PageServerLoad} from './$types';
import {getLegalPage} from '$lib/server/legalPages';
import {prepareMarkdownPage} from '$lib/markdown';

export const load: PageServerLoad = async () => {
  const pageData = await getLegalPage('security');
  const {html, headings} = await prepareMarkdownPage(pageData.content);

  return {pageData, html, headings};
};
