import type { Project } from '@idstead/domain/types.ts';
import { fetchProjects } from '#lib/server/githubProjects.ts';
import { runInBackground } from '#lib/server/workerEnv.ts';

const PROJECTS_CACHE_SECONDS = 600;
const PROJECTS_CACHE_ORIGIN = 'https://projects-cache.fkp.my.id';

interface EdgeCache {
    match(key: string): Promise<Response | undefined>;
    put(key: string, response: Response): Promise<void>;
}

function edgeCache(): EdgeCache | undefined {
    return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

function cacheKey(githubUsername: string) {
    return `${PROJECTS_CACHE_ORIGIN}/github/${encodeURIComponent(githubUsername.toLowerCase())}`;
}

async function readCachedProjects(cache: EdgeCache, key: string): Promise<Project[] | null> {
    try {
        const hit = await cache.match(key);
        if (!hit) return null;
        const projects: unknown = await hit.json();
        return Array.isArray(projects) ? (projects as Project[]) : null;
    } catch {
        return null;
    }
}

export async function fetchCachedProjects(
    githubUsername: string,
    fetchFn: typeof fetch,
    platform: unknown
): Promise<Project[]> {
    if (!githubUsername) return [];

    const cache = edgeCache();
    const key = cacheKey(githubUsername);
    if (cache) {
        const cached = await readCachedProjects(cache, key);
        if (cached) return cached;
    }

    const projects = await fetchProjects(githubUsername, fetchFn, platform);

    if (cache && projects.length > 0) {
        const response = Response.json(projects, {
            headers: { 'cache-control': `public, max-age=${PROJECTS_CACHE_SECONDS}` }
        });
        await runInBackground(cache.put(key, response).catch(() => {}));
    }

    return projects;
}

export function withoutExcludedProjects(projects: Project[], excludedNames: string[]) {
    if (excludedNames.length === 0) return projects;
    const excluded = new Set(excludedNames.map(name => name.toLowerCase()));
    return projects.filter(project => !excluded.has(project.name.toLowerCase()));
}
