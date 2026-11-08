// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './routes/support.ts';

const mdrsData = await import('../apps/admin/src/routes/api/internal/admin/mdrs-data/+server.ts');
const validateDefine =
    await import('../apps/admin/src/routes/api/internal/blog/validate-define/+server.ts');

function post(path: string, body: unknown) {
    const url = new URL(`https://admin.example.com/api/internal/${path}`);
    return {
        request: new Request(url, {
            method: 'POST',
            headers: { origin: url.origin, 'content-type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body)
        }),
        url,
        platform: {}
    } as any;
}

const json = async (response: Response) => (await response.json()) as any;

const author = {
    profile: async () => null,
    resumeEntries: async () => ({ experience: [], education: [] }),
    fundingLinks: async () => [],
    contactLinks: async () => [],
    skillGroups: async () => [],
    socialLinks: async () => []
};

beforeEach(() => {
    admin.authFailure = null;
    slots.dataStores = () => ({ service: undefined });
});

describe('admin MDRS data route', () => {
    test('refuses requests that fail the same-origin admin check', async () => {
        admin.authFailure = Response.json({ code: 'FORBIDDEN' }, { status: 403 });
        const response = await mdrsData.POST(post('admin/mdrs-data', { scope: 'author' }));
        expect(response.status).toBe(403);
    });

    test('rejects unknown scopes and malformed bodies', async () => {
        for (const body of ['not json', { scope: 'nope' }]) {
            const response = await mdrsData.POST(post('admin/mdrs-data', body));
            expect(response.status).toBe(400);
            expect(await json(response)).toMatchObject({ code: 'MDRS_DATA_SCOPE_INVALID' });
        }
    });

    test('rejects an invalid post slug', async () => {
        const response = await mdrsData.POST(
            post('admin/mdrs-data', { scope: 'post', slug: 'Bad Slug!' })
        );
        expect(response.status).toBe(400);
        expect(await json(response)).toMatchObject({ code: 'MDRS_DATA_SLUG_INVALID' });
    });

    test('reports unavailable live data when no service is configured', async () => {
        const response = await mdrsData.POST(post('admin/mdrs-data', { scope: 'author' }));
        expect(response.status).toBe(503);
        expect(await json(response)).toMatchObject({ code: 'MDRS_DATA_UNAVAILABLE' });
    });

    test('returns the author, blog and post scopes from the repositories', async () => {
        slots.dataStores = () => ({
            service: {
                author,
                site: {},
                blog: {
                    listPublished: async () => ({
                        posts: [
                            {
                                id: 'p1',
                                title: 'Hello',
                                slug: 'hello',
                                excerpt: 'Hi',
                                collaborators: [],
                                created_at: '2026-01-02T00:00:00.000Z',
                                updated_at: null
                            }
                        ]
                    }),
                    getPublishedBySlug: async () => null,
                    readMarkdown: async () => ''
                }
            }
        });

        const authorData = await mdrsData.POST(post('admin/mdrs-data', { scope: 'author' }));
        expect(authorData.status).toBe(200);
        expect(await json(authorData)).toHaveProperty('data');

        const blog = await mdrsData.POST(post('admin/mdrs-data', { scope: 'blog' }));
        expect(await json(blog)).toMatchObject({ data: [{ slug: 'hello', title: 'Hello' }] });

        const missing = await mdrsData.POST(
            post('admin/mdrs-data', { scope: 'post', slug: 'hello' })
        );
        expect(missing.status).toBe(404);
        expect(await json(missing)).toMatchObject({ code: 'MDRS_DATA_NOT_FOUND' });
    });

    test('reports a failing analytics read as unavailable', async () => {
        slots.dataStores = () => ({
            service: {
                author,
                blog: {},
                site: {
                    analytics: async () => {
                        throw new Error('db');
                    }
                }
            }
        });
        const response = await mdrsData.POST(post('admin/mdrs-data', { scope: 'analytics' }));
        expect(response.status).toBe(503);
        expect(await json(response)).toMatchObject({ code: 'MDRS_DATA_UNAVAILABLE' });
    });
});

describe('blog define validation route', () => {
    test('refuses requests that fail the same-origin admin check', async () => {
        admin.authFailure = Response.json({ code: 'FORBIDDEN' }, { status: 403 });
        const response = await validateDefine.POST(post('blog/validate-define', { markdown: 'x' }));
        expect(response.status).toBe(403);
    });

    test('rejects invalid JSON and empty markdown', async () => {
        const invalid = await validateDefine.POST(post('blog/validate-define', 'not json'));
        expect(invalid.status).toBe(400);
        expect(await json(invalid)).toMatchObject({ code: 'INVALID_JSON_BODY' });

        const empty = await validateDefine.POST(post('blog/validate-define', { markdown: '  ' }));
        expect(empty.status).toBe(400);
        expect(await json(empty)).toMatchObject({ code: 'BLOG_DEFINE_MARKDOWN_REQUIRED' });
    });

    test('accepts markdown the engine validates', async () => {
        slot.validateDefineForSave = async () => ({ ok: true, errors: [] });
        const response = await validateDefine.POST(
            post('blog/validate-define', { markdown: '# Hello' })
        );
        expect(await json(response)).toEqual({ errors: [] });
    });

    test('reports engine errors as a validation failure', async () => {
        slot.validateDefineForSave = async () => ({
            ok: false,
            errors: [{ key: 'v', message: "'nobody' is undefined" }, { message: 'Unclosed block' }]
        });
        const response = await validateDefine.POST(
            post('blog/validate-define', { markdown: ':::define\nv: "Hai $nobody"\n:::\n' })
        );
        expect(response.status).toBe(422);
        expect(await json(response)).toMatchObject({
            code: 'BLOG_DEFINE_VALIDATION_FAILED',
            message: "v: 'nobody' is undefined | Unclosed block"
        });
    });
});
