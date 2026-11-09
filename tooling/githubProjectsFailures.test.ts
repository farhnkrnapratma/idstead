// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { fetchProjects } = await import('../packages/lib/src/server/githubProjects.ts');

const platform = { env: { GITHUB_PAT: 'token' } };

function repo(name: string) {
    return {
        name,
        full_name: `owner/${name}`,
        description: null,
        html_url: `https://github.com/owner/${name}`,
        clone_url: `https://github.com/owner/${name}.git`,
        ssh_url: `git@github.com:owner/${name}.git`,
        default_branch: 'main',
        language: null,
        stargazers_count: 0,
        forks_count: 0,
        created_at: null,
        pushed_at: null,
        topics: [],
        fork: false,
        archived: false,
        private: false,
        license: null
    };
}

describe('fetchProjects failures', () => {
    test('returns no projects when GitHub rejects the repository list', async () => {
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
        try {
            const projects = await fetchProjects(
                (async () =>
                    new Response('denied', {
                        status: 403,
                        statusText: 'Forbidden'
                    })) as unknown as typeof fetch,
                platform
            );
            expect(projects).toEqual([]);
            expect(warnings.join(' ')).toContain('GitHub API error: 403 Forbidden');
        } finally {
            console.warn = originalWarn;
        }
    });

    test('returns no projects when the repository request throws', async () => {
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
        try {
            const projects = await fetchProjects(
                (async () => {
                    throw new Error('offline');
                }) as unknown as typeof fetch,
                platform
            );
            expect(projects).toEqual([]);
            expect(warnings.join(' ')).toContain('offline');
        } finally {
            console.warn = originalWarn;
        }
    });

    test('counts zero branches when the branch listing is not JSON', async () => {
        const projects = await fetchProjects(
            (async (input: RequestInfo | URL) => {
                const url = String(input);
                if (url.includes('/user/repos')) return Response.json([repo('alpha')]);
                if (url.includes('/branches')) return new Response('not json', { status: 200 });
                return Response.json([]);
            }) as unknown as typeof fetch,
            platform
        );
        expect(projects.map(project => project.name)).toEqual(['alpha']);
        expect(projects[0].branches).toBe(0);
    });
});
