import {env as privateEnv} from '$env/dynamic/private';
import {S3Client, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {supabase} from '$lib/supabase';
import type {PageServerLoad} from './$types';
import type {Project, ProjectLanguage} from '$lib/types';
import {getLanguageColor} from '$lib/utils/githubLanguageColors';
import {decodeHtmlEntities} from '$lib/utils/formatters';
import {
  fetchAuthorProfileWithSocials,
  fetchCvEntries,
  fetchFundingLinks,
  fetchContactInfo,
  fetchGroupedSkills,
  fetchActiveCvDocument
} from '$lib/author';

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  license: {key: string; name: string; spdx_id: string; url: string} | null;
}

function getLastPageCount(res: Response, fallbackCount: number): number {
  const link = res.headers.get('link');
  if (!link) return fallbackCount;
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : fallbackCount;
}

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

async function fetchRepoExtras(
  fullName: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch
): Promise<{branches: number; commits: number; languages: ProjectLanguage[]}> {
  const base = `https://api.github.com/repos/${fullName}`;

  const [branchesRes, commitsRes, languagesRes] = await Promise.all([
    fetchFn(`${base}/branches?per_page=1`, {headers}),
    fetchFn(`${base}/commits?per_page=1`, {headers}),
    fetchFn(`${base}/languages`, {headers})
  ]);

  let branches = 0;
  if (branchesRes.ok) {
    const body = await branchesRes.json();
    branches = getLastPageCount(
      branchesRes,
      Array.isArray(body) ? body.length : 0
    );
  }

  let commits = 0;
  if (commitsRes.ok) {
    const body = await commitsRes.json();
    commits = getLastPageCount(
      commitsRes,
      Array.isArray(body) ? body.length : 0
    );
  }

  let languages: ProjectLanguage[] = [];
  if (languagesRes.ok) {
    const bytesByLang: Record<string, number> = await languagesRes.json();
    const total = Object.values(bytesByLang).reduce((sum, b) => sum + b, 0);
    if (total > 0) {
      languages = Object.entries(bytesByLang)
        .map(([name, bytes]) => ({
          name,
          percent: Math.round((bytes / total) * 1000) / 10,
          color: getLanguageColor(name)
        }))
        .sort((a, b) => b.percent - a.percent);
    }
  }

  return {branches, commits, languages};
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

function extractGitHubUsername(author: any): string {
  if (author?.username && typeof author.username === 'string') {
    return author.username.trim();
  }
  if (Array.isArray(author?.socialLinks)) {
    const githubLink = author.socialLinks.find(
      (link: any) => link?.platform?.toLowerCase() === 'github'
    );
    if (githubLink?.url) {
      const match = githubLink.url.match(/github\.com\/([a-zA-Z0-9_.-]+)/i);
      if (match) return match[1];
    }
  }
  return '';
}

export const load: PageServerLoad = async ({fetch, platform, locals}) => {
  let projects: Project[] = [];
  let dbPosts: BlogPost[] = [];

  const supabaseClient = (locals as any)?.supabase || supabase;
  const logoCatalog = await fetchLogoCatalog();

  const [author, cv, funding, contact, skillsGrouped, cvDocument] =
    await Promise.all([
      fetchAuthorProfileWithSocials(supabaseClient),
      fetchCvEntries(supabaseClient),
      fetchFundingLinks(supabaseClient),
      fetchContactInfo(supabaseClient),
      fetchGroupedSkills(supabaseClient),
      fetchActiveCvDocument(supabaseClient, fetch)
    ]);

  const githubUsername = extractGitHubUsername(author);

  if (githubUsername) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'portfolio-sveltekit'
      };

      const token =
        (platform as any)?.env?.GITHUB_TOKEN
        ?? (platform as any)?.env?.GITHUB_PAT
        ?? privateEnv.GITHUB_PAT
        ?? privateEnv.GITHUB_TOKEN
        ?? process.env.GITHUB_PAT
        ?? process.env.GITHUB_TOKEN
        ?? '';

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?sort=pushed&direction=desc&per_page=30&type=owner`,
        {headers}
      );

      if (res.ok) {
        const repos: GitHubRepo[] = await res.json();
        const activeRepos = repos.filter(repo => !repo.fork && !repo.archived);

        projects = await Promise.all(
          activeRepos.map(async repo => {
            let extras = {
              branches: 0,
              commits: 0,
              languages: [] as ProjectLanguage[]
            };
            try {
              extras = await fetchRepoExtras(repo.full_name, headers, fetch);
            } catch (e) {
              console.error(`Failed to fetch extras for ${repo.full_name}:`, e);
            }

            return {
              name: repo.name,
              fullName: repo.full_name,
              desc: repo.description ?? 'No description provided.',
              tags: repo.topics.length > 0 ? repo.topics : [],
              url: repo.html_url,
              cloneUrl: repo.clone_url,
              sshUrl: repo.ssh_url,
              zipUrl: `${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip`,
              lang: repo.language ?? undefined,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              branches: extras.branches,
              commits: extras.commits,
              languages: extras.languages,
              pushedAt: repo.pushed_at ?? null,
              licenseName: repo.license?.spdx_id ?? null,
              licenseUrl:
                repo.license ? `${repo.html_url}/blob/main/LICENSE` : null
            };
          })
        );
      } else {
        console.error(`GitHub API error: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error('Failed to fetch GitHub repos:', err);
    }
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
            const fileRes = await fetch(urlData.publicUrl);
            if (fileRes.ok) {
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
