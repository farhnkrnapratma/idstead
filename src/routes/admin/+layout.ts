import type {LayoutLoad} from './$types';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({fetch, parent}) => {
  await parent();
  return {};
};
