// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { Project } from '../packages/domain/src/types.ts';
import { homeProjects } from '../apps/web/src/lib/projectLists.ts';

function project(name: string, pushedAt: string): Project {
    return { name, pushedAt } as Project;
}

describe('homeProjects', () => {
    const projects = [
        project('old-pinned', '2026-01-01T00:00:00Z'),
        project('newest', '2026-10-20T00:00:00Z'),
        project('middle', '2026-06-01T00:00:00Z')
    ];

    test('lists pinned projects first, then the most recently pushed', () => {
        expect(homeProjects(projects, ['old-pinned'], 2).map(p => p.name)).toEqual([
            'old-pinned',
            'newest'
        ]);
    });

    test('matches pinned names case-insensitively through the lowercased list', () => {
        expect(
            homeProjects([project('Old-Pinned', '2026-01-01T00:00:00Z')], ['old-pinned'], 1)
        ).toHaveLength(1);
    });

    test('lists the most recently pushed projects when none are pinned', () => {
        expect(homeProjects(projects, [], 2).map(p => p.name)).toEqual(['newest', 'middle']);
    });
});
