// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    getBlog,
    getBlogComments,
    getBlogContent,
    getBlogViews,
    getSearch,
    publicPostMeta,
    type ApiContext
} from '../packages/lib/src/server/api/blog.ts';
import { ApiRequestError } from '../packages/lib/src/server/api/params.ts';

const POST = {
    id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    slug: 'hello',
    title: 'Hello',
    excerpt: 'An excerpt',
    tags: ['a', 'b'],
    collaborators: [],
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: null,
    source: { kind: 'post-source' }
};

interface Overrides {
    find?: unknown;
    findFails?: boolean;
    stats?: unknown;
    statsFails?: boolean;
    list?: unknown;
    listFails?: boolean;
    markdown?: string | null;
    comments?: unknown[];
    commentsFails?: boolean;
    recentFails?: boolean;
}

function context(path: string, overrides: Overrides = {}, accept?: string): ApiContext {
    const url = new URL(`https://example.com${path}`);
    const repos = {
        blog: {
            findPublished: async () => {
                if (overrides.findFails) throw new Error('down');
                return overrides.find ?? { status: 'found', post: POST };
            },
            postStats: async () => {
                if (overrides.statsFails) throw new Error('down');
                return overrides.stats ?? { views_count: 7, comment_count: 2 };
            },
            listPublished: async () => {
                if (overrides.listFails) throw new Error('down');
                return overrides.list ?? { posts: [POST], total: 1 };
            },
            readMarkdown: async () => {
                if (overrides.markdown === null) throw new Error('missing');
                return overrides.markdown ?? '# Hello\n\nBody *text*';
            }
        },
        comments: {
            listApproved: async () => {
                if (overrides.commentsFails) throw new Error('down');
                return (
                    overrides.comments ?? [
                        {
                            id: 'c1',
                            parent_id: null,
                            author_name: 'A',
                            content: 'x',
                            is_anonymous: false,
                            is_admin: false,
                            created_at: 't'
                        },
                        {
                            id: 'c2',
                            parent_id: 'c1',
                            author_name: 'B',
                            content: 'y',
                            is_anonymous: true,
                            is_admin: true,
                            created_at: 't'
                        },
                        {
                            id: 'c3',
                            parent_id: null,
                            author_name: 'C',
                            content: 'z',
                            is_anonymous: false,
                            is_admin: false,
                            created_at: 't'
                        }
                    ]
                );
            },
            listRecentApproved: async () => {
                if (overrides.recentFails) throw new Error('down');
                return [{ id: 'r1' }];
            }
        }
    };
    return {
        url,
        request: new Request(url, accept ? { headers: { Accept: accept } } : undefined),
        repos: repos as never,
        fetch: fetch
    };
}

async function failure(work: Promise<unknown>) {
    try {
        await work;
    } catch (error) {
        return error as ApiRequestError;
    }
    throw new Error('expected a failure');
}

const bodyOf = async (response: Response) => response.text();

describe('publicPostMeta', () => {
    test('falls back to the creation date for updated_at', () => {
        expect(publicPostMeta(POST as never).updated_at).toBe(POST.created_at);
        expect(
            publicPostMeta({ ...POST, updated_at: '2026-10-02T00:00:00.000Z' } as never).updated_at
        ).toBe('2026-10-02T00:00:00.000Z');
    });
});

describe('getBlog', () => {
    test('returns a single post as json, markdown and text', async () => {
        const json = await getBlog(context(`/v1/blog?id=${POST.id}`));
        expect(await json.json()).toMatchObject({
            slug: 'hello',
            views_count: 7,
            comment_count: 2
        });
        const md = await bodyOf(await getBlog(context(`/v1/blog?id=${POST.id}&output=md`)));
        expect(md).toContain('# Hello');
        expect(md).toContain('**Views**: 7 | **Comments**: 2');
        expect(md).toContain('**Tags**: a, b');
        expect(md).toContain('> An excerpt');
        const text = await bodyOf(await getBlog(context(`/v1/blog?id=${POST.id}&output=txt`)));
        expect(text).toContain('Views: 7 | Comments: 2');
        const bare = await bodyOf(
            await getBlog(
                context(`/v1/blog?id=${POST.id}&output=txt`, {
                    find: { status: 'found', post: { ...POST, excerpt: null, tags: [] } }
                })
            )
        );
        expect(bare).not.toContain('An excerpt');
    });

    test('rejects conflicting parameters and maps lookup results to errors', async () => {
        expect((await failure(getBlog(context(`/v1/blog?id=${POST.id}&page=2`)))).status).toBe(400);
        for (const [find, status, code] of [
            [{ status: 'invalid' }, 400, 'BLOG_POST_ID_INVALID'],
            [{ status: 'ambiguous' }, 409, 'BLOG_POST_ID_AMBIGUOUS'],
            [{ status: 'missing' }, 404, 'BLOG_POST_NOT_FOUND']
        ] as const) {
            const error = await failure(getBlog(context('/v1/blog?id=abc', { find })));
            expect(error.status).toBe(status);
            expect(error.code).toBe(code);
        }
        expect(
            (await failure(getBlog(context('/v1/blog?id=abc', { findFails: true })))).status
        ).toBe(500);
        expect(
            (await failure(getBlog(context(`/v1/blog?id=${POST.id}`, { statsFails: true })))).status
        ).toBe(500);
    });

    test('lists posts with pagination as json and markdown', async () => {
        const body = (await (
            await getBlog(context('/v1/blog?limit=1&page=2', { list: { posts: [POST], total: 3 } }))
        ).json()) as { pagination: Record<string, unknown> };
        expect(body.pagination).toEqual({
            page: 2,
            limit: 1,
            total: 3,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: true
        });
        const md = await bodyOf(await getBlog(context('/v1/blog?output=md&query=hel')));
        expect(md).toContain('# Posts Catalog');
        expect(md).toContain('Total posts: 1');
        expect((await failure(getBlog(context('/v1/blog', { listFails: true })))).code).toBe(
            'BLOG_LIST_FETCH_FAILED'
        );
    });
});

describe('getBlogContent', () => {
    test('serves markdown, text and json and reports missing content', async () => {
        const md = await bodyOf(await getBlogContent(context(`/v1/blog/content?id=${POST.id}`)));
        expect(md).toContain('Body *text*');
        const txt = await bodyOf(
            await getBlogContent(context(`/v1/blog/content?id=${POST.id}&output=txt`))
        );
        expect(txt).toContain('Body text');
        const json = await (
            await getBlogContent(context(`/v1/blog/content?id=${POST.id}&output=json`))
        ).json();
        expect(json).toMatchObject({ slug: 'hello', content: expect.stringContaining('Body') });
        expect(
            (
                await failure(
                    getBlogContent(context(`/v1/blog/content?id=${POST.id}`, { markdown: null }))
                )
            ).status
        ).toBe(502);
        const missing = await failure(getBlogContent(context('/v1/blog/content')));
        expect(missing.code).toBe('BLOG_POST_ID_REQUIRED');
    });
});

describe('getBlogComments', () => {
    test('nests replies, limits threads and lists recent comments', async () => {
        const one = (await (
            await getBlogComments(context(`/v1/blog/comments?id=${POST.id}&limit=1`))
        ).json()) as { data: { replies: { author_name: string }[] }[]; hasMore: boolean };
        expect(one.data).toHaveLength(1);
        expect(one.data[0].replies[0].author_name).toBe('Anonymous');
        expect(one.hasMore).toBe(true);
        expect(await (await getBlogComments(context('/v1/blog/comments'))).json()).toEqual({
            data: [{ id: 'r1' }]
        });
        expect(
            (
                await failure(
                    getBlogComments(
                        context(`/v1/blog/comments?id=${POST.id}`, { commentsFails: true })
                    )
                )
            ).code
        ).toBe('BLOG_COMMENTS_FETCH_FAILED');
        expect(
            (await failure(getBlogComments(context('/v1/blog/comments', { recentFails: true }))))
                .status
        ).toBe(500);
    });
});

describe('getBlogViews', () => {
    test('returns the view count and surfaces failures', async () => {
        expect(await (await getBlogViews(context(`/v1/blog/views?id=${POST.id}`))).json()).toEqual({
            id: POST.id,
            slug: 'hello',
            views: 7
        });
        expect(
            (
                await failure(
                    getBlogViews(context(`/v1/blog/views?id=${POST.id}`, { statsFails: true }))
                )
            ).code
        ).toBe('BLOG_VIEWS_FETCH_FAILED');
    });
});

describe('getSearch', () => {
    test('short-circuits trivial queries and paginates real ones', async () => {
        for (const query of ['', 'a', '..', '(,)']) {
            const body = (await (
                await getSearch(context(`/v1/search?query=${encodeURIComponent(query)}`))
            ).json()) as { data: unknown[] };
            expect(body.data).toEqual([]);
        }
        const posts = [
            POST,
            { ...POST, id: 'b', slug: 'b', excerpt: null },
            { ...POST, id: 'c', slug: 'c' }
        ];
        const body = (await (
            await getSearch(
                context('/v1/search?query=hello&limit=2', { list: { posts, total: 3 } })
            )
        ).json()) as {
            data: { subtitle: string; url: string }[];
            pagination: { hasMore: boolean; returned: number };
        };
        expect(body.data.map(item => item.url)).toEqual(['/blog/hello', '/blog/b']);
        expect(body.data[1].subtitle).toBe('Blog post');
        expect(body.pagination).toMatchObject({ hasMore: true, returned: 2 });
        expect(
            (await failure(getSearch(context('/v1/search?query=hello', { listFails: true })))).code
        ).toBe('SEARCH_FETCH_FAILED');
    });
});
