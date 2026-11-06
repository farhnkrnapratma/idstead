// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = {
    profile: async (): Promise<unknown> => null,
    listPublished: async (_page: { limit: number; offset: number }): Promise<unknown> => ({
        posts: []
    })
};

mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: () => ({
        author: { profile: () => state.profile() },
        blog: {
            listPublished: (page: { limit: number; offset: number }) => state.listPublished(page)
        }
    })
}));

const metadata = await import('../packages/lib/src/server/publicMetadata.ts');

const platform = { env: { PUBLIC_SITE_URL: 'https://fallback.test/' } };
const profile = {
    name: 'Ada',
    username: 'ada',
    bio: 'Bio',
    headline: 'Head',
    email: 'ada@example.com',
    manifestSettings: { display: 'standalone' },
    avatarVersion: undefined,
    createdAt: 'c',
    updatedAt: 'u',
    siteUrl: 'https://profile.test/path'
};

beforeEach(() => {
    state.profile = async () => null;
    state.listPublished = async () => ({ posts: [] });
});

const status = async (promise: Promise<unknown> | (() => unknown)) => {
    try {
        await (typeof promise === 'function' ? promise() : promise);
    } catch (error) {
        return (error as { status: number }).status;
    }
    return 0;
};

describe('readSite', () => {
    test('prefers the profile site url', async () => {
        state.profile = async () => profile;
        const site = await metadata.readSite(platform);
        expect(site.siteUrl).toBe('https://profile.test');
        expect(site.profile).toMatchObject({
            name: 'Ada',
            username: 'ada',
            email: 'ada@example.com',
            avatar_version: null,
            created_at: 'c',
            updated_at: 'u',
            manifest_settings: { display: 'standalone' }
        });
    });

    test('falls back to the configured origin', async () => {
        const site = await metadata.readSite(platform);
        expect(site).toEqual({ siteUrl: 'https://fallback.test', profile: null });
        state.profile = async () => ({ ...profile, siteUrl: 'ftp://x', avatarVersion: 'v1' });
        const withVersion = await metadata.readSite(platform);
        expect(withVersion.siteUrl).toBe('https://fallback.test');
        expect(withVersion.profile?.avatar_version).toBe('v1');
    });

    test('fails when no origin or profile is available', async () => {
        expect(await status(metadata.readSite({ env: {} }))).toBe(503);
        expect(await status(metadata.readSite({ env: { PUBLIC_SITE_URL: 'ftp://x' } }))).toBe(503);
        state.profile = async () => {
            throw new Error('down');
        };
        expect(await status(metadata.readSite(platform))).toBe(503);
    });
});

describe('readPublishedPosts', () => {
    const post = (index: number) => ({
        id: `id-${index}`,
        slug: `slug-${index}`,
        title: `Title ${index}`,
        excerpt: null,
        created_at: 'c',
        updated_at: null,
        extra: true
    });

    test('pages until a short page', async () => {
        const offsets: number[] = [];
        state.listPublished = async ({ limit, offset }) => {
            offsets.push(offset);
            expect(limit).toBe(500);
            return {
                posts: Array.from({ length: offset === 0 ? 500 : 2 }, (_, i) => post(offset + i))
            };
        };
        const posts = await metadata.readPublishedPosts();
        expect(offsets).toEqual([0, 500]);
        expect(posts).toHaveLength(502);
        expect(posts[0]).toEqual({
            slug: 'slug-0',
            title: 'Title 0',
            excerpt: null,
            created_at: 'c',
            updated_at: null,
            id: 'id-0'
        });
    });

    test('fails when the repository fails', async () => {
        state.listPublished = async () => {
            throw new Error('down');
        };
        expect(await status(metadata.readPublishedPosts())).toBe(503);
    });
});

describe('helpers', () => {
    test('validDate', () => {
        expect(metadata.validDate('2026-01-01')).toBe('2026-01-01T00:00:00.000Z');
        expect(metadata.validDate('garbage')).toBeUndefined();
        expect(metadata.validDate(5)).toBeUndefined();
    });

    test('markdownText escapes and flattens', () => {
        expect(metadata.markdownText('a\r\n*b* [c] `d` _e_ <f> \\')).toBe(
            'a \\*b\\* \\[c\\] \\`d\\` \\_e\\_ \\<f\\> \\\\'
        );
    });
});
