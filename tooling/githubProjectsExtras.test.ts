// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { fetchProjects } = await import('../packages/lib/src/server/githubProjects.ts');

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

const lastPage = (page: number) => ({
    link: `<https://api.github.com/x?per_page=1&page=${page}>; rel="last"`
});

test('reads page counts, the latest commit and social images', async () => {
    const calls: string[] = [];
    const fetchFn = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.startsWith('https://api.github.com/user/repos'))
            return Response.json([repo('site'), repo('docs')]);
        if (url.endsWith('/graphql'))
            return Response.json({
                data: {
                    viewer: {
                        repositories: {
                            nodes: [
                                { name: 'Site', openGraphImageUrl: 'https://og.example/site.png' }
                            ]
                        }
                    }
                }
            });
        if (url.includes('/owner/site/branches'))
            return new Response('[]', { headers: lastPage(7) });
        if (url.includes('/owner/site/commits'))
            return new Response(JSON.stringify([{ sha: 'abcdef1234567' }]), {
                headers: lastPage(42)
            });
        if (url.includes('/owner/docs/branches')) throw new Error('network down');
        if (url.includes('/owner/docs/commits')) return new Response('not json');
        return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    const projects = await fetchProjects(fetchFn, { env: { GITHUB_PAT: 'token' } });
    const text = JSON.stringify(projects);
    expect(text).toContain('abcdef1');
    expect(text).not.toContain('abcdef12');
    expect(text).toContain('https://og.example/site.png');
    expect(text).toContain('"branches":7');
    expect(text).toContain('"commits":42');
});
