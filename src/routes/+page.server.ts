import {supabase} from '$lib/supabase';
import type {PageServerLoad} from './$types';
import type {Project} from '$lib/types';
import {decodeHtmlEntities} from '$lib/utils/formatters';
import {fetchProjects, extractGitHubUsername} from '$lib/server/githubProjects';
import {
  fetchAuthorProfileWithSocials,
  fetchCvEntries,
  fetchFundingLinks,
  fetchContactInfo,
  fetchGroupedSkills,
  fetchActiveCvDocument,
  fetchProjectRepoRules
} from '$lib/author';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  pinned: boolean;
  storage_path: string;
  banner_path?: string | null;
  created_at: string;
  updated_at?: string | null;
  excerpt?: string | null;
  content: string;
  read_time?: string;
  comment_count?: number;
  views_count?: number;
  tags?: string[];
}

export const load: PageServerLoad = async ({fetch, platform, locals}) => {
  let projects: Project[] = [];
  let dbPosts: BlogPost[] = [];

  const supabaseClient = (locals as any)?.supabase || supabase;

  const [author, cv, funding, contact, skillsGrouped, cvDocument, repoRules] =
    await Promise.all([
      fetchAuthorProfileWithSocials(supabaseClient, {includeEmail: true}),
      fetchCvEntries(supabaseClient),
      fetchFundingLinks(supabaseClient),
      fetchContactInfo(supabaseClient),
      fetchGroupedSkills(supabaseClient),
      fetchActiveCvDocument(supabaseClient, fetch),
      fetchProjectRepoRules(supabaseClient)
    ]);

  const githubUsername = extractGitHubUsername(author);
  if (githubUsername) {
    projects = await fetchProjects(
      githubUsername,
      fetch,
      platform,
      repoRules.excluded
    );
  }

  try {
    const {data, error} = await supabase
      .from('db_posts')
      .select('*')
      .eq('published', true)
      .order('created_at', {ascending: false});
    if (!error && data) {
      dbPosts = await Promise.all(
        data.map(async post => {
          let readTime = '1 min read';
          let commentCount = 0;
          try {
            const {data: urlData} = supabase.storage
              .from('blog-posts')
              .getPublicUrl(post.storage_path);
            const fileRes = await fetch(urlData.publicUrl, {
              signal: AbortSignal.timeout(3000)
            }).catch(() => null);
            if (fileRes?.ok) {
              const text = await fileRes.text();
              const words = text.trim().split(/\s+/).length;
              const minutes = Math.max(1, Math.ceil(words / 200));
              readTime = `${minutes} min${minutes > 1 ? 's' : ''} read`;
            }
          } catch (err) {
            console.error(err);
          }

          try {
            const {count} = await supabase
              .from('db_comments')
              .select('*', {count: 'exact', head: true})
              .eq('post_id', post.id)
              .eq('is_approved', true);
            commentCount = count ?? 0;
          } catch (err) {
            console.error(err);
          }

          let viewsCount = 0;
          try {
            const {count} = await supabase
              .from('db_views')
              .select('*', {count: 'exact', head: true})
              .eq('post_id', post.id);
            viewsCount = count ?? 0;
          } catch (err) {
            console.error(err);
          }

          return {
            ...post,
            tags:
              Array.isArray(post.tags) ?
                post.tags.map(decodeHtmlEntities)
              : post.tags,
            read_time: readTime,
            comment_count: commentCount,
            views_count: viewsCount
          };
        })
      );
    }
  } catch (err) {
    console.error(err);
  }

  return {
    projects,
    pinnedRepoNames: repoRules.pinned,
    posts: dbPosts,
    author,
    cv,
    funding,
    contact,
    skills: skillsGrouped,
    cvExists: Boolean(cvDocument?.fileUrl)
  };
};
