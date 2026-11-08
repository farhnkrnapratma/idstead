// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin } from './support.ts';

const activityLog =
    await import('../../apps/admin/src/routes/api/internal/admin/activity-log/+server.ts');
const postDraft =
    await import('../../apps/admin/src/routes/api/internal/admin/posts/draft/+server.ts');
const postList =
    await import('../../apps/admin/src/routes/api/internal/admin/posts/list/+server.ts');
const author = await import('../../apps/admin/src/routes/api/internal/admin/author/+server.ts');

const POST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function get(path: string) {
    const url = new URL(`https://admin.example.com/api/internal/admin/${path}`);
    return { request: new Request(url), url, platform: {} } as any;
}

const json = async (response: Response) => (await response.json()) as any;

beforeEach(() => {
    admin.response = null;
    admin.authFailure = null;
    admin.service = undefined;
});

describe('admin activity log route', () => {
    test('returns the refusal from the admin check', async () => {
        admin.response = Response.json({ code: 'DENIED' }, { status: 401 });
        expect((await activityLog.GET(get('activity-log') as any)).status).toBe(401);
    });

    test('rejects an unknown category', async () => {
        admin.service = { activityLog: { list: async () => ({ data: [], total: 0 }) } };
        const response = await activityLog.GET(get('activity-log?category=nope') as any);
        expect(response.status).toBe(400);
        expect(await json(response)).toMatchObject({
            code: 'ACTIVITY_LOG_INVALID_QUERY',
            message: 'Invalid category.'
        });
    });

    test('reports a failed list as unavailable', async () => {
        admin.service = {
            activityLog: {
                list: async () => {
                    throw new Error('db');
                }
            }
        };
        const response = await activityLog.GET(get('activity-log') as any);
        expect(response.status).toBe(503);
        expect(await json(response)).toMatchObject({ code: 'ACTIVITY_LOG_FETCH_FAILED' });
    });

    test('returns the page with the parsed paging values', async () => {
        let seen: any;
        admin.service = {
            activityLog: {
                list: async (query: unknown) => {
                    seen = query;
                    return { data: [{ id: 'a1' }], total: 1 };
                }
            }
        };
        const response = await activityLog.GET(get('activity-log?category=profile') as any);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await json(response)).toEqual({
            data: [{ id: 'a1' }],
            total: 1,
            limit: seen.limit,
            offset: seen.offset
        });
    });
});

describe('admin post routes', () => {
    test('refuses a draft lookup from the admin check', async () => {
        admin.response = Response.json({ code: 'DENIED' }, { status: 403 });
        expect((await postDraft.GET(get(`posts/draft?id=${POST_ID}`) as any)).status).toBe(403);
    });

    test('rejects a malformed post id', async () => {
        const response = await postDraft.GET(get('posts/draft?id=nope') as any);
        expect(response.status).toBe(400);
        expect(await json(response)).toMatchObject({ code: 'BLOG_POST_INVALID' });
    });

    test('reports a failed draft load as unavailable', async () => {
        admin.service = {
            adminPosts: {
                posts: {
                    get: async () => {
                        throw new Error('db');
                    }
                }
            }
        };
        const response = await postDraft.GET(get(`posts/draft?id=${POST_ID}`) as any);
        expect(response.status).toBe(503);
        expect(await json(response)).toMatchObject({ code: 'BLOG_POSTS_UNAVAILABLE' });
    });

    test('reports a missing draft as not found', async () => {
        admin.service = { adminPosts: { posts: { get: async () => null } } };
        const response = await postDraft.GET(get(`posts/draft?id=${POST_ID}`) as any);
        expect(response.status).toBe(404);
        expect(await json(response)).toMatchObject({ code: 'BLOG_POST_NOT_FOUND' });
    });

    test('returns the draft post', async () => {
        admin.service = { adminPosts: { posts: { get: async () => ({ title: 'Draft' }) } } };
        const response = await postDraft.GET(get(`posts/draft?id=${POST_ID.toUpperCase()}`) as any);
        expect(response.status).toBe(200);
        expect(await json(response)).toEqual({ post: { title: 'Draft' } });
    });

    test('lists posts and reports a failed list as unavailable', async () => {
        admin.service = { adminPosts: { posts: { list: async () => [{ id: 'p1' }] } } };
        const listed = await postList.GET(get('posts/list') as any);
        expect(listed.status).toBe(200);
        expect(await json(listed)).toEqual({ posts: [{ id: 'p1' }] });

        admin.service = {
            adminPosts: {
                posts: {
                    list: async () => {
                        throw new Error('db');
                    }
                }
            }
        };
        const failed = await postList.GET(get('posts/list') as any);
        expect(failed.status).toBe(503);
        expect(await json(failed)).toMatchObject({ code: 'BLOG_POSTS_UNAVAILABLE' });
    });
});

describe('admin author route', () => {
    test('returns the full snapshot or only the profile', async () => {
        admin.service = {
            adminAuthor: {
                snapshot: async () => ({ profile: { name: 'Ada' }, skills: [] }),
                profile: async () => ({ name: 'Ada' })
            }
        };
        const all = await author.GET(get('author') as any);
        expect(all.status).toBe(200);
        expect(all.headers.get('cache-control')).toBe('no-store');
        expect(await json(all)).toEqual({ profile: { name: 'Ada' }, skills: [] });
        expect(await json(await author.GET(get('author?part=profile') as any))).toEqual({
            profile: { name: 'Ada' }
        });
    });

    test('rejects unknown parts and reports failed loads as unavailable', async () => {
        admin.service = { adminAuthor: { snapshot: async () => ({}) } };
        const invalid = await author.GET(get('author?part=links') as any);
        expect(invalid.status).toBe(400);
        expect(await json(invalid)).toMatchObject({ code: 'AUTHOR_INVALID_PART' });

        admin.service = {
            adminAuthor: {
                snapshot: async () => {
                    throw new Error('db');
                }
            }
        };
        const failed = await author.GET(get('author') as any);
        expect(failed.status).toBe(503);
        expect(await json(failed)).toMatchObject({ code: 'AUTHOR_UNAVAILABLE' });
    });
});
