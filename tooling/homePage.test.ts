// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: HomePage } = (await import('../apps/web/src/routes/(site)/+page.svelte')) as {
    default: never;
};

const realFetch = globalThis.fetch;
const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const author = {
    name: 'Ada Lovelace',
    username: 'ada',
    headline: 'Engineer',
    jobTitle: 'Developer',
    bio: 'Builds small, careful tools.',
    avatar: '',
    avatarVersion: 'a1',
    siteUrl: 'https://example.com',
    email: 'ada@example.com',
    city: 'London',
    country: 'UK',
    socialLinks: [],
    experience: [],
    education: [],
    skills: []
};

const post = {
    id: 'post-1',
    slug: 'hello',
    title: 'Hello world',
    excerpt: 'An excerpt',
    created_at: '2026-01-02T10:00:00.000Z',
    updated_at: null,
    read_time: '3 min read',
    comment_count: 2,
    views_count: 9,
    tags: ['svelte'],
    pinned: true,
    banner_url: null,
    banner_credit: null
};

const project = {
    name: 'idstead',
    fullName: 'ada/idstead',
    desc: 'Personal site',
    tags: ['svelte'],
    url: 'https://github.com/ada/idstead',
    cloneUrl: '',
    sshUrl: '',
    zipUrl: '',
    stars: 3,
    forks: 0,
    branches: 1,
    commits: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    pushedAt: '2026-02-01T00:00:00.000Z',
    licenseName: 'AGPL-3.0',
    licenseUrl: null,
    lang: 'TypeScript',
    langColor: '#3178c6'
};

beforeEach(() => {
    (page as unknown as { url: URL }).url = new URL('https://example.com/');
    (page as { data: unknown }).data = {
        author,
        posts: [post],
        projects: [project],
        pinnedRepoNames: ['idstead'],
        experience: [
            {
                id: 'e1',
                title: 'Engineer',
                type: 'Full-time',
                company: 'Example',
                location: 'Remote',
                loc_type: 'Remote',
                start_date: '2024-01-01',
                end_date: null,
                currently_in: true,
                description: '- Built tools\n- Shipped releases'
            }
        ],
        education: [
            {
                id: 'ed1',
                institution: 'Uni',
                degree: 'BSc',
                field: 'Computing',
                location: 'London',
                start_date: '2015-09-01',
                end_date: '2018-06-01',
                currently_in: false,
                grade: '',
                description: ''
            }
        ],
        resumeDocument: null,
        hasFunding: true,
        hasPublishedPosts: true,
        newsletterEnabled: true
    };
    globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('renders the profile, posts, projects and resume highlights', async () => {
    mounted.push(
        mount(HomePage, {
            target: document.body,
            props: { data: (page as { data: unknown }).data } as never
        })
    );
    await settle();
    expect(document.body.textContent).toContain('Ada Lovelace');
    expect(document.body.textContent).toContain('Hello world');
    expect(document.body.textContent).toContain('idstead');
}, 60000);
