import type {LayoutServerLoad} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfileWithSocials} from '$lib/author';
import {fetchProjects, extractGitHubUsername} from '$lib/server/githubProjects';

export const load: LayoutServerLoad = async ({fetch, platform, setHeaders}) => {
  const author = await fetchAuthorProfileWithSocials(supabase);

  const githubUsername = extractGitHubUsername(author);
  const projects =
    githubUsername ? await fetchProjects(githubUsername, fetch, platform) : [];

  try {
    setHeaders({'cache-control': 'public, max-age=3600, s-maxage=86400'});
  } catch {}
  return {author, projects};
};
