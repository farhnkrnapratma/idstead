import {env as privateEnv} from '$env/dynamic/private';
import type {Project} from '$lib/types';
import {getLanguageColor} from '$lib/utils/githubLanguageColors';

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

let cachedProjects: Project[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchRepoExtras(
  fullName: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch
): Promise<{branches: number; commits: number; latestCommitSha?: string}> {
  const base = `https://api.github.com/repos/${fullName}`;

  const [branchesRes, commitsRes] = await Promise.all([
    fetchFn(`${base}/branches?per_page=1`, {
      headers,
      signal: AbortSignal.timeout(3000)
    }).catch(() => null),
    fetchFn(`${base}/commits?per_page=1`, {
      headers,
      signal: AbortSignal.timeout(3000)
    }).catch(() => null)
  ]);

  let branches = 0;
  if (branchesRes?.ok) {
    try {
      const body = await branchesRes.json();
      branches = getLastPageCount(
        branchesRes,
        Array.isArray(body) ? body.length : 0
      );
    } catch {
      branches = 0;
    }
  }

  let commits = 0;
  let latestCommitSha: string | undefined = undefined;
  if (commitsRes?.ok) {
    try {
      const body = await commitsRes.json();
      commits = getLastPageCount(
        commitsRes,
        Array.isArray(body) ? body.length : 0
      );
      if (Array.isArray(body) && body.length > 0 && body[0]?.sha) {
        latestCommitSha = String(body[0].sha).slice(0, 7);
      }
    } catch {
      commits = 0;
    }
  }

  return {branches, commits, latestCommitSha};
}

export function extractGitHubUsername(author: any): string {
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

export async function fetchProjects(
  githubUsername: string,
  fetchFn: typeof fetch,
  platform: unknown
): Promise<Project[]> {
  if (!githubUsername) return [];

  if (
    cachedProjects.length > 0
    && cachedProjects.every(p => p.latestCommitSha !== undefined)
    && Date.now() - cacheTimestamp < CACHE_TTL_MS
  ) {
    return cachedProjects;
  }

  let projects: Project[] = [];

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

    const res = await fetchFn(
      `https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?sort=pushed&direction=desc&per_page=30&type=owner`,
      {headers, signal: AbortSignal.timeout(4000)}
    );

    if (res.ok) {
      const repos: GitHubRepo[] = await res.json();
      const activeRepos = repos.filter(repo => !repo.fork && !repo.archived);

      projects = await Promise.all(
        activeRepos.map(async repo => {
          let extras: {
            branches: number;
            commits: number;
            latestCommitSha?: string;
          } = {branches: 0, commits: 0};
          try {
            extras = await fetchRepoExtras(repo.full_name, headers, fetchFn);
          } catch (e) {
            console.warn(
              `Failed to fetch extras for ${repo.full_name}:`,
              (e as Error)?.message || e
            );
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
            langColor:
              repo.language ? getLanguageColor(repo.language) : undefined,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            branches: extras.branches,
            commits: extras.commits,
            latestCommitSha: extras.latestCommitSha,
            pushedAt: repo.pushed_at ?? null,
            licenseName: repo.license?.spdx_id ?? null,
            licenseUrl:
              repo.license ? `${repo.html_url}/blob/main/LICENSE` : null
          };
        })
      );

      if (projects.length > 0) {
        cachedProjects = projects;
        cacheTimestamp = Date.now();
      }
    } else {
      console.warn(`GitHub API error: ${res.status} ${res.statusText}`);
      if (cachedProjects.length > 0) {
        projects = cachedProjects;
      }
    }
  } catch (err) {
    console.warn(
      'Failed to fetch GitHub repos:',
      (err as Error)?.message || err
    );
    if (cachedProjects.length > 0) {
      projects = cachedProjects;
    }
  }

  return projects;
}
