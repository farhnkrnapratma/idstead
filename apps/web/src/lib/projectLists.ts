import type { Project } from '@idstead/domain/types.ts';

const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isRepoPinned(project: Project, pinnedNames: string[]): boolean {
    return pinnedNames.includes(project.name.toLowerCase());
}

export function isRepoNew(project: Project, now = Date.now()): boolean {
    if (!project.createdAt) return false;
    return now - new Date(project.createdAt).getTime() < NEW_ITEM_WINDOW_MS;
}

export function recentlyPushed(
    projects: Project[],
    pinnedNames: string[],
    count: number
): Project[] {
    return projects
        .filter(project => !isRepoPinned(project, pinnedNames))
        .sort((a, b) => new Date(b.pushedAt || 0).getTime() - new Date(a.pushedAt || 0).getTime())
        .slice(0, count);
}
