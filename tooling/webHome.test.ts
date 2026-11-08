// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = {
    resume: { experience: [1, 2, 3], education: [1, 2] } as Record<string, unknown[]>,
    resumeError: false,
    funding: [{ id: 'f' }] as unknown[],
    fundingError: false,
    posts: [{ id: 'p1' }] as unknown[],
    document: null as unknown,
    lastFetch: null as unknown
};

mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: () => ({
        author: {
            resumeEntries: async () => {
                if (state.resumeError) throw new Error('db');
                return state.resume;
            },
            fundingLinks: async () => {
                if (state.fundingError) throw new Error('db');
                return state.funding;
            }
        }
    })
}));
mock.module('../packages/lib/src/server/blogPosts.ts', () => ({
    loadPublishedPosts: async (fetchFn: unknown) => {
        state.lastFetch = fetchFn;
        return state.posts;
    }
}));
mock.module('../packages/lib/src/server/publicResumeDocument.ts', () => ({
    loadPublicResumeDocument: async () => state.document
}));

const { load } = await import('../apps/web/src/routes/(site)/+page.server.ts');

const fetchFn = (async () => new Response()) as unknown as typeof fetch;

beforeEach(() => {
    state.resume = { experience: [1, 2, 3], education: [1, 2] };
    state.resumeError = false;
    state.funding = [{ id: 'f' }];
    state.fundingError = false;
    state.posts = [{ id: 'p1' }];
    state.document = null;
});

describe('home page loader', () => {
    test('limits the resume to the home page entries and reports posts and funding', async () => {
        state.document = { fileUrl: 'x' };
        const data = (await load({ fetch: fetchFn } as never)) as Record<string, unknown>;
        expect(data.experience).toEqual([1, 2]);
        expect(data.education).toEqual([1]);
        expect(data.posts).toEqual([{ id: 'p1' }]);
        expect(data.hasPublishedPosts).toBe(true);
        expect(data.hasFunding).toBe(true);
        expect(data.resumeDocument).toEqual({ fileUrl: 'x' });
        expect(state.lastFetch).toBe(fetchFn);
    });

    test('falls back to an empty resume and no funding when those reads fail', async () => {
        state.resumeError = true;
        state.fundingError = true;
        state.posts = [];
        const data = (await load({ fetch: fetchFn } as never)) as Record<string, unknown>;
        expect(data.experience).toEqual([]);
        expect(data.education).toEqual([]);
        expect(data.hasFunding).toBe(false);
        expect(data.hasPublishedPosts).toBe(false);
    });
});
