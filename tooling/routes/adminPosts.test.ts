// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { admin, more, slot, slots } from './support.ts';

class BannerRequiredError extends Error {}
class OperationReusedError extends Error {}

const OPERATION = '0f8fad5b-d9cb-469f-a165-70867728950e';

const state = {
    service: undefined as any,
    auth: { status: 0, actor: 'actor-1' } as Record<string, any>,
    input: undefined as any,
    parseError: undefined as unknown,
    validation: { ok: true, errors: [] } as { ok: boolean; errors: Array<{ message: string }> },
    previous: undefined as any,
    current: undefined as any,
    slugTaken: false,
    assetCalls: 0,
    relocateError: undefined as unknown,
    renderError: false,
    operation: undefined as any,
    operationError: undefined as unknown,
    syncError: false,
    cleanup: { cleanupPending: false } as { cleanupPending: boolean },
    cleanupError: false,
    found: undefined as any,
    findError: false,
    banners: [] as string[],
    effects: [] as unknown[],
    synced: [] as unknown[]
};

slots.dataStores = () => ({ service: state.service });
mock.module('../../packages/lib/src/server/blogPostAuth.ts', () => ({
    blogAdmin: async () => state.auth
}));
slot.parsePostInput = async () => {
    if (state.parseError !== undefined) throw state.parseError;
    return structuredClone(state.input);
};
mock.module('../../packages/lib/src/server/blogPostSave.ts', () => ({
    BannerRequiredError,
    OperationReusedError,
    savePostOperation: async (
        _operations: unknown,
        _actor: string,
        input: any,
        putBanners: () => Promise<void>,
        render: string | null
    ) => {
        if (state.operationError !== undefined) throw state.operationError;
        await putBanners();
        state.operation = { ...state.operation, render };
        return state.operation;
    }
}));
slots.putBanner = async (_p: unknown, _id: string, _op: string, _image: unknown, kind: string) =>
    void state.banners.push(kind);
slots.cleanupBlogAssets = async () => {
    if (state.cleanupError) throw new Error('cleanup');
    return state.cleanup;
};
slot.relocateMarkdownAssets = async ({ markdown }: { markdown: string }) => {
    if (state.relocateError !== undefined) throw state.relocateError;
    return `${markdown}\nrelocated`;
};
slot.syncPostAssets = async (options: unknown) => {
    if (state.syncError) throw new Error('sync');
    state.synced.push(options);
};
mock.module('../../packages/lib/src/server/mdrsData.ts', () => ({ mdrsResolvers: () => ({}) }));
more.buildPostRender = async () => {
    if (state.renderError) throw new Error('render');
    return { html: '<p>x</p>' };
};
mock.module('../../packages/lib/src/mdrsOptions.ts', () => ({ siteRenderOptions: () => ({}) }));
mock.module('../../packages/lib/src/server/siteUrl.ts', () => ({
    configuredSiteUrl: () => 'https://example.com'
}));
slot.queuePostEffects = async (_newsletter: unknown, _platform: unknown, effect: unknown) =>
    void state.effects.push(effect);
mock.module('@mdrs/core', () => ({ validateDefineForSave: async () => state.validation }));

const { POST, GET } =
    (await import('../../apps/admin/src/routes/api/internal/admin/posts/+server.ts')) as {
        POST: (event: any) => Promise<Response>;
        GET: (event: any) => Promise<Response>;
    };

function event(search = '') {
    return {
        request: new Request('https://admin.example.com/api/internal/admin/posts', {
            method: 'POST'
        }),
        url: new URL(`https://admin.example.com/api/internal/admin/posts${search}`),
        platform: {},
        getClientAddress: () => '203.0.113.1'
    };
}

const saveInput = (extra: Record<string, unknown> = {}) => ({
    kind: 'save',
    id: 'post-1',
    operationId: OPERATION,
    markdown: '# Title\n\nbody',
    post: { slug: 'title', published: true },
    ...extra
});

beforeEach(() => {
    state.service = {
        adminPosts: {
            posts: {
                assetState: async () => (++state.assetCalls % 2 ? state.previous : state.current),
                slugTaken: async () => state.slugTaken
            },
            operations: {
                find: async () => (state.findError ? Promise.reject(new Error('x')) : state.found)
            }
        },
        writers: { newsletter: {} }
    };
    state.auth = { status: 0, actor: 'actor-1' };
    state.input = saveInput();
    state.parseError = undefined;
    state.validation = { ok: true, errors: [] };
    state.previous = { published: false };
    state.current = { id: 'post-1', published: true };
    state.slugTaken = false;
    state.assetCalls = 0;
    state.relocateError = undefined;
    state.renderError = false;
    state.operation = {
        state: 'saved',
        id: OPERATION,
        result: { id: 'post-1', slug: 'title', published: true }
    };
    state.operationError = undefined;
    state.syncError = false;
    state.cleanup = { cleanupPending: false };
    state.cleanupError = false;
    state.found = undefined;
    state.findError = false;
    state.banners = [];
    state.effects = [];
    state.synced = [];
    admin.logged = [];
});

async function failure(response: Response) {
    return { status: response.status, body: (await response.json()) as Record<string, any> };
}

describe('POST /api/internal/admin/posts', () => {
    test('rejects missing storage and failed authorization', async () => {
        state.service = undefined;
        expect((await POST(event())).status).toBe(503);
        state.service = { adminPosts: {} };
        state.auth = { status: 401, message: 'no' };
        const bare = await failure(await POST(event()));
        expect(bare.status).toBe(401);
        expect(bare.body.code).toBe('BLOG_SAVE_AUTH_REQUIRED');
        state.auth = { status: 403, code: 'FORBIDDEN', message: 'no' };
        expect((await failure(await POST(event()))).body.code).toBe('FORBIDDEN');
    });

    test('reports invalid input', async () => {
        state.parseError = new Error('bad input');
        const named = await failure(await POST(event()));
        expect(named.status).toBe(400);
        expect(named.body.message).toBe('bad input');
        state.parseError = 'broken';
        expect((await failure(await POST(event()))).body.message).toBe('Invalid post data.');
    });

    test('rejects invalid defines, taken slugs and missing assets', async () => {
        state.validation = { ok: false, errors: [{ message: 'a' }, { message: 'b' }] };
        const invalid = await failure(await POST(event()));
        expect(invalid.status).toBe(422);
        expect(invalid.body.message).toBe('a | b');
        state.validation = { ok: true, errors: [] };
        state.slugTaken = true;
        expect((await failure(await POST(event()))).body.code).toBe('BLOG_SAVE_REJECTED');
        state.slugTaken = false;
        state.relocateError = new Error('missing file');
        const missing = await failure(await POST(event()));
        expect(missing.body).toMatchObject({
            code: 'BLOG_SAVE_ASSET_MISSING',
            message: 'missing file'
        });
        state.relocateError = 'x';
        expect((await failure(await POST(event()))).body.message).toBe(
            'A file used in the post is missing.'
        );
    });

    test('saves a post with banners, effects, asset sync and activity log', async () => {
        state.input = saveInput({ image: new Uint8Array(1), avifImage: new Uint8Array(1) });
        const response = await POST(event());
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(body).toMatchObject({
            success: true,
            operationId: OPERATION,
            cleanupPending: false,
            markdown: '# Title\n\nbody\nrelocated'
        });
        expect(state.banners).toEqual(['webp', 'avif']);
        expect(state.operation.render).toBe(JSON.stringify({ html: '<p>x</p>' }));
        expect(state.effects).toEqual([{ postId: 'post-1', published: true, wasPublished: false }]);
        expect(admin.logged[0]).toMatchObject({ action: 'blog.publish', entityId: 'post-1' });
        expect(admin.logged[0].summary).toBe('publish post "title".');
        expect(state.synced).toHaveLength(1);
    });

    test('updates unpublished posts and tolerates render, sync and cleanup failures', async () => {
        state.renderError = true;
        state.syncError = true;
        state.previous = undefined;
        state.operation = { state: 'saved', id: OPERATION, result: { id: 'post-1' } };
        const original = console.error;
        console.error = () => {};
        try {
            const first = await (await POST(event())).json();
            expect(first.cleanupPending).toBe(true);
            expect(state.operation.render).toBeNull();
            expect(admin.logged[0].action).toBe('blog.update');
            expect(admin.logged[0].summary).toBe('update post.');
            expect(state.effects[0]).toMatchObject({ published: false, wasPublished: false });

            state.syncError = false;
            state.cleanup = { cleanupPending: true };
            expect((await (await POST(event())).json()).cleanupPending).toBe(true);
            state.cleanup = { cleanupPending: false };
            state.cleanupError = true;
            expect((await (await POST(event())).json()).cleanupPending).toBe(true);

            state.cleanupError = false;
            state.current = undefined;
            state.operation = { state: 'saved', id: OPERATION, result: undefined };
            const bare = await (await POST(event())).json();
            expect(bare.post).toBeUndefined();
            expect(state.effects.at(-1)).toMatchObject({ postId: 'post-1', published: false });
        } finally {
            console.error = original;
        }
    });

    test('deletes posts', async () => {
        state.input = { kind: 'delete', id: 'post-1', operationId: OPERATION };
        state.operation = {
            state: 'saved',
            id: OPERATION,
            result: { id: 'post-1', deleted: true }
        };
        const body = await (await POST(event())).json();
        expect(body.markdown).toBeNull();
        expect(admin.logged[0].action).toBe('blog.delete');
        expect(state.synced[0]).toMatchObject({ markdown: null, deleted: true });
    });

    test('maps operation states and errors', async () => {
        state.operation = { state: 'conflict', id: OPERATION };
        expect((await failure(await POST(event()))).body.code).toBe('BLOG_REVISION_CONFLICT');
        state.operation = { state: 'rejected', id: OPERATION };
        expect((await failure(await POST(event()))).body.code).toBe('BLOG_SAVE_REJECTED');

        state.operationError = new BannerRequiredError('banner');
        expect((await failure(await POST(event()))).body).toMatchObject({
            code: 'BLOG_SAVE_INVALID_INPUT',
            message: 'banner'
        });
        state.operationError = new OperationReusedError('reused');
        expect((await failure(await POST(event()))).body.code).toBe('BLOG_OPERATION_REUSED');
        state.operationError = new Error('db down');
        const unconfirmed = await failure(await POST(event()));
        expect(unconfirmed.status).toBe(503);
        expect(unconfirmed.body.code).toBe('BLOG_SAVE_UNCONFIRMED');
    });
});

describe('GET /api/internal/admin/posts', () => {
    test('checks storage and authorization', async () => {
        state.service = undefined;
        expect((await GET(event())).status).toBe(503);
        state.service = { adminPosts: {} };
        state.auth = { status: 401, message: 'no' };
        expect((await failure(await GET(event()))).body.code).toBe('BLOG_SAVE_AUTH_REQUIRED');
        state.auth = { status: 403, code: 'FORBIDDEN', message: 'no' };
        expect((await failure(await GET(event()))).body.code).toBe('FORBIDDEN');
    });

    test('validates the operation id and reports status', async () => {
        expect((await failure(await GET(event('')))).body.code).toBe('BLOG_OPERATION_INVALID');
        expect((await failure(await GET(event('?operationId=nope')))).status).toBe(400);
        const query = `?operationId=${OPERATION}`;
        const unknown = await (await GET(event(query))).json();
        expect(unknown).toEqual({ state: 'unknown' });
        state.found = { id: OPERATION, state: 'saved', result: { id: 'post-1' } };
        expect(await (await GET(event(query))).json()).toEqual({
            operationId: OPERATION,
            state: 'saved',
            post: { id: 'post-1' }
        });
        state.findError = true;
        expect((await failure(await GET(event(query)))).body.code).toBe(
            'BLOG_RECONCILIATION_UNAVAILABLE'
        );
    });
});
