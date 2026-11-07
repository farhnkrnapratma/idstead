// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { postCard, postCardMeta, projectCard } from '../apps/web/src/lib/contentCards.ts';
import type { Project } from '../packages/domain/src/types.ts';

const DAY = 24 * 60 * 60 * 1000;

const post = {
    slug: 'hello world',
    title: 'Hello',
    excerpt: 'Excerpt',
    pinned: true,
    created_at: new Date(Date.now() - 1000).toISOString(),
    updated_at: '2026-02-01T00:00:00.000Z',
    read_time: '3 min read',
    comment_count: 2,
    views_count: 10,
    tags: ['a&amp;b', 'c d'],
    banner_url: 'https://cdn.example.com/banner.webp'
};

const project: Project = {
    name: 'idstead',
    fullName: 'ada/idstead',
    desc: 'Personal site',
    tags: ['svelte'],
    url: 'https://github.com/ada/idstead',
    cloneUrl: '',
    sshUrl: '',
    zipUrl: '',
    stars: 1,
    forks: 0,
    branches: 1,
    commits: 1,
    createdAt: new Date(Date.now() - 1000).toISOString(),
    pushedAt: null,
    licenseName: null,
    licenseUrl: null,
    openGraphImageUrl: 'https://cdn.example.com/og.png'
};

describe('postCard', () => {
    test('maps a pinned, new post and decodes its tags', () => {
        const card = postCard(post, { banner: true });
        expect(card).toMatchObject({
            title: 'Hello',
            href: '/blog/hello world',
            pinned: true,
            pinnedLabel: 'Pinned post',
            isNew: true,
            description: 'Excerpt',
            tags: ['a&b', 'c d']
        });
        expect(card.image?.src).toBe('https://cdn.example.com/banner.webp');
        expect(card.tagHref('c d')).toBe('/blog?tag=c%20d');
        expect(card.tagAriaLabel('c d')).toBe('Show posts tagged c d');
    });

    test('omits the banner unless requested and treats old posts as not new', () => {
        const card = postCard(
            {
                ...post,
                pinned: undefined,
                created_at: new Date(Date.now() - 3 * DAY).toISOString(),
                tags: undefined
            },
            { banner: false }
        );
        expect(card.image).toBeNull();
        expect(card.pinned).toBe(false);
        expect(card.isNew).toBe(false);
        expect(card.tags).toEqual([]);
    });

    test('has no banner when the post has none', () => {
        expect(postCard({ ...post, banner_url: null }, { banner: true }).image).toBeNull();
    });

    test('treats a missing creation date as not new', () => {
        expect(postCard({ ...post, created_at: '' }).isNew).toBe(false);
    });
});

describe('postCardMeta', () => {
    test('shows counts only when they are non-zero', () => {
        expect(postCardMeta(post)).toMatchObject({
            date: post.created_at,
            updatedAt: '2026-02-01T00:00:00.000Z',
            commentsCount: 2,
            views: 10
        });
        const quiet = postCardMeta({ ...post, comment_count: 0, views_count: 0, updated_at: null });
        expect(quiet.commentsCount).toBeUndefined();
        expect(quiet.views).toBeUndefined();
        expect(quiet.updatedAt).toBeNull();
    });
});

describe('projectCard', () => {
    test('marks pinned and new repositories and links externally', () => {
        const card = projectCard(project, ['idstead']);
        expect(card).toMatchObject({
            title: 'idstead',
            href: 'https://github.com/ada/idstead',
            external: true,
            pinned: true,
            pinnedLabel: 'Pinned repository',
            isNew: true,
            newLabel: 'New repository',
            description: 'Personal site',
            tags: ['svelte'],
            tagNoun: 'topic'
        });
        expect(card.image?.src).toBe('https://cdn.example.com/og.png');
    });

    test('falls back to no image, no tags and not new', () => {
        const card = projectCard(
            {
                ...project,
                openGraphImageUrl: undefined,
                tags: undefined as unknown as string[],
                createdAt: null
            },
            []
        );
        expect(card.image).toBeNull();
        expect(card.tags).toEqual([]);
        expect(card.pinned).toBe(false);
        expect(card.isNew).toBe(false);
    });
});
