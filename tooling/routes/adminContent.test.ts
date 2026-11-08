// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './support.ts';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const state = {
    post: { id: UUID, slug: 'hello', published: true, pinned: false, post_revision: 3 } as any,
    previous: { published: false } as any,
    update: undefined as any,
    flagsError: false,
    moveError: false,
    effects: [] as unknown[],
    moved: 0,
    notify: { reason: undefined, sent: 2, failed: 0 } as any,
    notified: [] as unknown[][],
    reply: { status: 'created', comment: { id: 'c1' } } as any,
    replyError: false,
    replied: [] as any[],
    service: undefined as any,
    ensureError: false,
    saveRules: { status: 'saved' } as any,
    rules: [] as unknown[]
};

slot.movePostBanner = async () => {
    if (state.moveError) throw new Error('move');
    state.moved++;
};
slot.queuePostEffects = async (_n: unknown, _p: unknown, effect: unknown) =>
    void state.effects.push(effect);
slot.notifyNewPost = async (...args: unknown[]) => {
    state.notified.push(args);
    return state.notify;
};
slots.dataStores = () => ({ service: state.service });

const flags = await import('../../apps/admin/src/routes/api/internal/admin/posts/flags/+server.ts');
const notify =
    await import('../../apps/admin/src/routes/api/internal/admin/posts/notify/+server.ts');
const reply =
    await import('../../apps/admin/src/routes/api/internal/admin/comments/reply/+server.ts');
const projects = await import('../../apps/admin/src/routes/api/internal/admin/projects/+server.ts');

function event(body: unknown, raw?: string) {
    const url = new URL('https://admin.example.com/api/internal/admin/x');
    return {
        request: new Request(url, {
            method: 'POST',
            headers: { origin: url.origin, 'content-type': 'application/json' },
            body: raw ?? JSON.stringify(body)
        }),
        url,
        platform: {},
        getClientAddress: () => '203.0.113.3'
    } as any;
}

async function code(response: Response) {
    const body = (await response.json()) as any;
    return body.code ?? body.error?.code;
}

const quiet = async <T>(run: () => Promise<T>): Promise<T> => {
    const original = console.error;
    console.error = () => {};
    try {
        return await run();
    } finally {
        console.error = original;
    }
};

beforeEach(() => {
    admin.response = null;
    admin.authFailure = null;
    admin.logged.length = 0;
    state.post = { id: UUID, slug: 'hello', published: true, pinned: false, post_revision: 3 };
    state.previous = { published: false };
    state.update = { status: 'ok', post: state.post };
    state.flagsError = false;
    state.moveError = false;
    state.effects = [];
    state.moved = 0;
    state.notify = { reason: undefined, sent: 2, failed: 0 };
    state.notified = [];
    state.reply = { status: 'created', comment: { id: 'c1' } };
    state.replyError = false;
    state.replied = [];
    state.ensureError = false;
    state.saveRules = { status: 'saved' };
    state.rules = [];
    state.service = {
        adminPosts: {
            posts: {
                assetState: async () => {
                    if (state.flagsError) throw new Error('db');
                    return state.previous;
                },
                setFlags: async () => state.update
            }
        },
        writers: { newsletter: {} },
        adminActivity: {
            replyToComment: async (input: unknown) => {
                if (state.replyError) throw new Error('db');
                state.replied.push(input);
                return state.reply;
            }
        },
        adminAuthor: {
            ensureProfileId: async () => {
                if (state.ensureError) throw new Error('db');
                return 'author-1';
            }
        },
        authorWriter: {
            saveRepoRules: async (id: string, rules: unknown) => {
                state.rules.push([id, rules]);
                return state.saveRules;
            }
        }
    };
    admin.service = state.service;
});

describe('POST /api/internal/admin/posts/flags', () => {
    const post = (body: unknown, raw?: string) =>
        (flags.POST as any)(event(body, raw)) as Promise<Response>;

    test('rejects invalid requests', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await post({})).status).toBe(401);
        admin.response = null;
        expect(await code(await post(null, '{nope'))).toBe('INVALID_JSON_BODY');
        expect(await code(await post(null, 'null'))).toBe('INVALID_JSON_BODY');
        expect(await code(await post([1]))).toBe('INVALID_JSON_BODY');
        expect(await code(await post({ id: 'bad', published: true }))).toBe('BLOG_POST_INVALID');
        expect(await code(await post({ published: true }))).toBe('BLOG_POST_INVALID');
        for (const body of [
            { id: UUID },
            { id: UUID, published: true, pinned: true },
            { id: UUID, title: true },
            { id: UUID, published: 'yes' }
        ])
            expect(await code(await post(body))).toBe('BLOG_POST_FLAGS_INVALID');
    });

    test('maps storage outcomes', async () => {
        state.previous = null;
        expect((await post({ id: UUID, published: true })).status).toBe(404);
        state.previous = { published: false };
        state.flagsError = true;
        expect((await quiet(() => post({ id: UUID, published: true }))).status).toBe(503);
        state.flagsError = false;
        for (const [status, expected] of [
            ['not-found', 'BLOG_POST_NOT_FOUND'],
            ['excerpt-required', 'BLOG_POST_EXCERPT_REQUIRED'],
            ['pin-limit', 'BLOG_POST_PIN_LIMIT']
        ] as const) {
            state.update = { status };
            expect(await code(await post({ id: UUID.toUpperCase(), published: true }))).toBe(
                expected
            );
        }
    });

    test('publishes, unpublishes, pins and unpins', async () => {
        state.update = { status: 'ok', post: state.post };
        const published = await post({ id: UUID, published: true });
        expect(await published.json()).toEqual({
            post_revision: 3,
            published: true,
            pinned: false
        });
        expect(state.moved).toBe(1);
        expect(state.effects).toEqual([{ postId: UUID, published: true, wasPublished: false }]);
        expect(admin.logged.at(-1)!.action).toBe('blog.publish');

        state.previous = { published: true };
        await post({ id: UUID, published: true });
        expect(state.moved).toBe(1);

        state.update = { status: 'ok', post: { ...state.post, published: false } };
        await post({ id: UUID, published: false });
        expect(admin.logged.at(-1)!.action).toBe('blog.unpublish');

        state.moveError = true;
        state.previous = { published: false };
        state.update = { status: 'ok', post: state.post };
        await quiet(() => post({ id: UUID, published: true }));

        state.update = { status: 'ok', post: { ...state.post, pinned: true } };
        await post({ id: UUID, pinned: true });
        expect(admin.logged.at(-1)!.action).toBe('blog.pin');
        await post({ id: UUID, pinned: false });
        expect(admin.logged.at(-1)!.action).toBe('blog.unpin');
        expect(state.effects).toHaveLength(4);
    });
});

describe('POST /api/internal/admin/posts/notify', () => {
    const post = (body: unknown, raw?: string) =>
        (notify.POST as any)(event(body, raw)) as Promise<Response>;

    test('rejects invalid requests', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await post({})).status).toBe(401);
        admin.response = null;
        expect(await code(await post(null, '{nope'))).toBe('INVALID_JSON_BODY');
        expect(await code(await post({ postId: 'x' }))).toBe('BLOG_NOTIFY_INVALID_POST');
        expect(await code(await post({}))).toBe('BLOG_NOTIFY_INVALID_POST');
    });

    test('maps notification outcomes', async () => {
        for (const [reason, status] of [
            ['unavailable', 503],
            ['unpublished', 409]
        ] as const) {
            state.notify = { reason, sent: 0, failed: 0 };
            expect((await post({ postId: UUID })).status).toBe(status);
        }
        state.notify = { reason: 'send-failed', sent: 1, failed: 2 };
        const failed = await post({ postId: UUID });
        expect(failed.status).toBe(502);
        expect(((await failed.json()) as any).message).toContain('1 of 3');
    });

    test('reports how many subscribers received the post', async () => {
        state.notify = { reason: undefined, sent: 1, failed: 0 };
        const one = await post({ postId: UUID, force: true });
        expect(await one.json()).toEqual({ sent: 1, reason: null });
        expect(state.notified[0][3]).toBe(true);
        expect(admin.logged.at(-1)!.summary).toBe('Sent a post to 1 subscriber.');
        state.notify = { reason: 'no-subscribers', sent: 0, failed: 0 };
        const none = await post({ postId: UUID });
        expect(await none.json()).toEqual({ sent: 0, reason: 'no-subscribers' });
        expect(admin.logged.at(-1)!.summary).toBe('Sent a post to 0 subscribers.');
        expect(state.notified[1][3]).toBe(false);
    });
});

describe('POST /api/internal/admin/comments/reply', () => {
    const post = (body: unknown, raw?: string) =>
        (reply.POST as any)(event(body, raw)) as Promise<Response>;
    const valid = { postId: UUID, parentId: UUID, authorName: ' Ada <b>', content: ' Thanks ' };

    test('validates the request', async () => {
        admin.authFailure = Response.json({ code: 'NO' }, { status: 403 });
        expect((await post(valid)).status).toBe(403);
        admin.authFailure = null;
        expect(await code(await post(null, '{nope'))).toBe('INVALID_JSON_BODY');
        expect(await code(await post({ ...valid, postId: 'x' }))).toBe(
            'BLOG_COMMENT_INVALID_POST_ID'
        );
        expect(await code(await post({ ...valid, parentId: '' }))).toBe(
            'BLOG_COMMENT_INVALID_PARENT_ID'
        );
        expect(await code(await post({ ...valid, content: '  ' }))).toBe(
            'BLOG_COMMENT_CONTENT_REQUIRED'
        );
        expect(await code(await post({ ...valid, content: 'x'.repeat(2001) }))).toBe(
            'BLOG_COMMENT_CONTENT_TOO_LONG'
        );
        expect(await code(await post(null, 'null'))).toBe('BLOG_COMMENT_INVALID_POST_ID');
    });

    test('stores replies and maps failures', async () => {
        const created = await post(valid);
        expect(created.status).toBe(201);
        expect(state.replied[0].content).toBe('Thanks');
        await post({ ...valid, authorName: '  ' });
        expect(state.replied[1].authorName).toBe('Administrator');
        await post({ ...valid, authorName: 5 });
        expect(state.replied[2].authorName).toBe('Administrator');
        expect(admin.logged).toHaveLength(3);
        state.reply = { status: 'invalid-parent' };
        expect(await code(await post(valid))).toBe('BLOG_COMMENT_INVALID_PARENT_ID');
        state.replyError = true;
        expect((await post(valid)).status).toBe(500);
        state.service = undefined;
        expect(await code(await post(valid))).toBe('DATABASE_UNAVAILABLE');
    });
});

describe('POST /api/internal/admin/projects', () => {
    const post = (body: unknown, raw?: string) =>
        (projects.POST as any)(event(body, raw)) as Promise<Response>;

    test('validates pinned and excluded names', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await post({})).status).toBe(401);
        admin.response = null;
        expect(await code(await post(null, '{nope'))).toBe('PROJECTS_INVALID_INPUT');
        const invalid = [
            { pinned: 'x', excluded: [] },
            { pinned: ['a', 'b', 'c', 'd'], excluded: [] },
            { pinned: [5], excluded: [] },
            { pinned: ['x'.repeat(101)], excluded: [] },
            { pinned: [], excluded: 'x' },
            { pinned: [], excluded: Array.from({ length: 101 }, (_, i) => `r${i}`) },
            null
        ];
        for (const body of invalid) expect((await post(body)).status).toBe(400);
    });

    test('saves normalized rules', async () => {
        const response = await post({ pinned: [' a ', 'a', ' '], excluded: ['c'] });
        expect(await response.json()).toEqual({ success: true, pinned: ['a'], excluded: ['c'] });
        expect(state.rules[0]).toEqual(['author-1', { pinned: ['a'], excluded: ['c'] }]);
        expect(admin.logged.at(-1)!.summary).toBe('Saved 1 pinned and 1 excluded repositories.');
    });

    test('maps storage failures', async () => {
        state.saveRules = { status: 'rejected', message: 'nope' };
        expect((await post({ pinned: [], excluded: [] })).status).toBe(400);
        state.ensureError = true;
        expect((await quiet(() => post({ pinned: [], excluded: [] }))).status).toBe(503);
    });
});
