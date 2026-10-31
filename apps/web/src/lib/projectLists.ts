// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Project } from '@idstead/domain/types.ts';

const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isRepoPinned(project: Project, pinnedNames: string[]): boolean {
    return pinnedNames.includes(project.name.toLowerCase());
}

export function isRepoNew(project: Project, now = Date.now()): boolean {
    if (!project.createdAt) return false;
    return now - new Date(project.createdAt).getTime() < NEW_ITEM_WINDOW_MS;
}

export function homeProjects(projects: Project[], pinnedNames: string[], count: number): Project[] {
    return projects
        .toSorted(
            (a, b) =>
                Number(isRepoPinned(b, pinnedNames)) - Number(isRepoPinned(a, pinnedNames))
                || new Date(b.pushedAt || 0).getTime() - new Date(a.pushedAt || 0).getTime()
        )
        .slice(0, count);
}
