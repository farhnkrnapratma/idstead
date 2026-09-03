import {env as privateEnv} from '$env/dynamic/private';
import {S3Client, ListObjectsV2Command} from '@aws-sdk/client-s3';
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
  fetchActiveCvDocument
} from '$lib/author';

interface LogoCatalogItem {
  name: string;
  extension: string;
  isThemeAware: boolean;
}

async function fetchLogoCatalog(): Promise<LogoCatalogItem[]> {
  const accountId = privateEnv.R2_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
  const accessKeyId =
    privateEnv.R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    privateEnv.R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = privateEnv.R2_BUCKET_NAME ?? process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return [];
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {accessKeyId, secretAccessKey}
  });

  const objectKeys: string[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: 'logo/',
          ContinuationToken: continuationToken
        })
      );

      for (const object of response.Contents ?? []) {
        if (object.Key) {
          objectKeys.push(object.Key);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  } catch (error) {
    console.error('Failed to list logo assets from R2:', error);
    return [];
  }

  const grouped = new Map<
    string,
    {extension: string; hasDark: boolean; hasLight: boolean}
  >();

  for (const key of objectKeys) {
    const normalizedKey = key.replace(/^logo\//, '');
    const match = normalizedKey.match(/^(.*?)(\.(svg|png|jpg|jpeg|webp))$/i);

    if (!match) continue;

    const [, baseName, , extension] = match;
    const cleanBaseName = baseName.replace(/-(dark|light)$/i, '');
    const suffix = baseName.match(/-(dark|light)$/i)?.[1]?.toLowerCase();

    const entry = grouped.get(cleanBaseName) ?? {
      extension: '',
      hasDark: false,
      hasLight: false
    };

    if (!entry.extension) {
      entry.extension = extension.toLowerCase();
    }

    if (suffix === 'dark') entry.hasDark = true;
    if (suffix === 'light') entry.hasLight = true;

    grouped.set(cleanBaseName, entry);
  }

  return Array.from(grouped.entries())
    .map(([name, entry]) => ({
      name,
      extension: entry.extension,
      isThemeAware: entry.hasDark && entry.hasLight
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  published: boolean;
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
  const logoCatalog = await fetchLogoCatalog();

  const [author, cv, funding, contact, skillsGrouped, cvDocument] =
    await Promise.all([
      fetchAuthorProfileWithSocials(supabaseClient, {includeEmail: true}),
      fetchCvEntries(supabaseClient),
      fetchFundingLinks(supabaseClient),
      fetchContactInfo(supabaseClient),
      fetchGroupedSkills(supabaseClient),
      fetchActiveCvDocument(supabaseClient, fetch)
    ]);

  const githubUsername = extractGitHubUsername(author);
  if (githubUsername) {
    projects = await fetchProjects(githubUsername, fetch, platform);
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
    posts: dbPosts,
    author,
    cv,
    funding,
    contact,
    skills: skillsGrouped,
    cvExists: Boolean(cvDocument?.fileUrl),
    logoCatalog
  };
};
