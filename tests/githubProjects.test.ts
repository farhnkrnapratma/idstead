// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { fetchProjects } = await import('../packages/lib/src/server/githubProjects.ts');

function repo(name: string, flags: Partial<Record<'private' | 'fork' | 'archived', boolean>> = {}) {
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
        license: null,
        ...flags
    };
}

describe('fetchProjects', () => {
    test('asks GitHub for nothing without a token', async () => {
        const calls: string[] = [];
        const projects = await fetchProjects(
            (async (input: RequestInfo | URL) => {
                calls.push(String(input));
                return Response.json([]);
            }) as typeof fetch,
            { env: { GITHUB_PAT: '' } }
        );
        expect(projects).toEqual([]);
        expect(calls).toEqual([]);
    });

    test("lists the token owner's public repositories and never a private one", async () => {
        const requests: { url: string; auth: string | null }[] = [];
        const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            requests.push({ url, auth: new Headers(init?.headers).get('authorization') });
            if (url.startsWith('https://api.github.com/user/repos'))
                return Response.json([
                    repo('site'),
                    repo('secret', { private: true }),
                    repo('fork', { fork: true }),
                    repo('old', { archived: true })
                ]);
            if (url.endsWith('/graphql')) return Response.json({ data: { viewer: null } });
            return Response.json([{ sha: 'abcdef1234' }]);
        }) as typeof fetch;

        const projects = await fetchProjects(fetchFn, { env: { GITHUB_PAT: ' token ' } });

        expect(projects.map(project => project.name)).toEqual(['site']);
        const list = requests.find(request => request.url.includes('/user/repos'));
        expect(list?.url).toContain('visibility=public');
        expect(list?.url).toContain('affiliation=owner');
        expect(list?.auth).toBe('Bearer token');
        expect(requests.some(request => request.url.includes('/users/'))).toBe(false);
    });
});
