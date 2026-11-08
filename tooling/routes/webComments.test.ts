// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

const POST_ID = 'a'.repeat(64);
const COMMENT_ID = 'b'.repeat(64);

const state = {
    body: {} as Record<string, unknown> | null,
    response: null as Response | null,
    profile: { name: 'Ada Lovelace' } as unknown,
    profileError: false,
    moderation: { safe: true, engine: 'ai', categories: [] as string[] } as any,
    data: undefined as any,
    lookup: { status: 'found', post: { id: 'p' } } as any,
    created: { status: 'created', comment: { id: COMMENT_ID } } as any,
    createError: false,
    created_with: [] as unknown[],
    salt: 'salt' as string | null,
    reportOutcome: 'reported' as string,
    reportError: false,
    reports: [] as unknown[]
};

slot.readPublicWrite = async () =>
    state.response ? { response: state.response } : { body: state.body };
slot.publicRepositories = () => ({
    author: {
        profile: () =>
            state.profileError ? Promise.reject(new Error('x')) : Promise.resolve(state.profile)
    }
});
slot.workerBinding = async () => ({});
slot.moderateContent = async () => state.moderation;
slot.ipSalt = () => state.salt;
slot.serviceData = () => state.data;

const comments = await import('../../apps/web/src/routes/api/internal/blog/comments/+server.ts');
const report =
    await import('../../apps/web/src/routes/api/internal/blog/comments/report/+server.ts');

const event = {
    platform: {},
    request: new Request('https://example.com'),
    getClientAddress: () => '203.0.113.2'
};
const post = (body: Record<string, unknown> | null) => {
    state.body = body;
    return (comments.POST as any)(event) as Promise<Response>;
};
const valid = { postId: POST_ID, authorName: 'Grace', content: 'Nice post' };

beforeEach(() => {
    state.body = {};
    state.response = null;
    state.profile = { name: 'Ada Lovelace' };
    state.profileError = false;
    state.moderation = { safe: true, engine: 'ai', categories: [] };
    state.lookup = { status: 'found', post: { id: 'p' } };
    state.created = { status: 'created', comment: { id: COMMENT_ID } };
    state.createError = false;
    state.created_with = [];
    state.salt = 'salt';
    state.reportOutcome = 'reported';
    state.reportError = false;
    state.reports = [];
    state.data = {
        blog: { findPublished: async () => state.lookup },
        writers: {
            comments: {
                create: async (...args: unknown[]) => {
                    if (state.createError) throw new Error('db');
                    state.created_with.push(args);
                    return state.created;
                },
                report: async (...args: unknown[]) => {
                    if (state.reportError) throw new Error('db');
                    state.reports.push(args);
                    return state.reportOutcome;
                }
            }
        }
    };
});

async function code(response: Response) {
    return ((await response.json()) as { code: string }).code;
}

describe('POST /api/internal/blog/comments', () => {
    test('returns the public write failure', async () => {
        state.response = Response.json({ code: 'TURNSTILE' }, { status: 403 });
        expect((await post(valid)).status).toBe(403);
    });

    test('validates every field', async () => {
        const cases: Array<[Record<string, unknown> | null, string]> = [
            [null, 'BLOG_COMMENT_INVALID_POST_ID'],
            [{ postId: 'nope', content: 'x' }, 'BLOG_COMMENT_INVALID_POST_ID'],
            [{ ...valid, parentId: 'bad' }, 'BLOG_COMMENT_INVALID_PARENT_ID'],
            [{ ...valid, content: '  ' }, 'BLOG_COMMENT_CONTENT_REQUIRED'],
            [{ ...valid, content: 'x'.repeat(2001) }, 'BLOG_COMMENT_CONTENT_TOO_LONG'],
            [{ ...valid, authorName: '' }, 'BLOG_COMMENT_AUTHOR_NAME_REQUIRED'],
            [{ ...valid, authorName: 'A' }, 'BLOG_COMMENT_AUTHOR_NAME_TOO_SHORT'],
            [{ ...valid, authorName: 'A'.repeat(51) }, 'BLOG_COMMENT_AUTHOR_NAME_TOO_LONG'],
            [{ ...valid, authorName: 'Ada Lovelace' }, 'BLOG_COMMENT_AUTHOR_NAME_RESERVED'],
            [{ ...valid, content: 'see https://spam.example' }, 'BLOG_COMMENT_LINKS_NOT_ALLOWED']
        ];
        for (const [body, expected] of cases) {
            const response = await post(body);
            expect(response.status).toBe(400);
            expect(await code(response)).toBe(expected);
        }
        state.profileError = true;
        expect((await post({ ...valid, authorName: 'Ada Lovelace' })).status).toBe(201);
    });

    test('requires moderation and storage', async () => {
        state.moderation = null;
        expect((await post(valid)).status).toBe(503);
        state.moderation = { safe: true, engine: 'ai', categories: [] };
        state.data = undefined;
        expect(await code(await post(valid))).toBe('BLOG_COMMENT_SERVICE_UNAVAILABLE');
    });

    test('creates approved and held comments', async () => {
        const response = await post({ ...valid, parentId: COMMENT_ID });
        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({
            is_approved: true,
            comment: { id: COMMENT_ID },
            moderation: { engine: 'ai' }
        });
        expect(state.created_with[0]).toMatchObject([
            { id: 'p' },
            { parentId: COMMENT_ID, approved: true }
        ]);
        state.moderation = { safe: false, engine: 'rules', categories: ['spam'] };
        expect(((await (await post(valid)).json()) as any).is_approved).toBe(false);
    });

    test('maps lookup, invalid parent and save failures', async () => {
        state.lookup = { status: 'missing' };
        expect((await post(valid)).status).toBe(404);
        state.lookup = { status: 'found', post: { id: 'p' } };
        state.created = { status: 'invalid-parent' };
        expect(await code(await post(valid))).toBe('BLOG_COMMENT_INVALID_PARENT_ID');
        state.createError = true;
        const original = console.error;
        console.error = () => {};
        try {
            expect(await code(await post(valid))).toBe('BLOG_COMMENT_SAVE_FAILED');
        } finally {
            console.error = original;
        }
    });
});

describe('POST /api/internal/blog/comments/report', () => {
    const send = (body: Record<string, unknown> | null) => {
        state.body = body;
        return (report.POST as any)(event) as Promise<Response>;
    };
    const ok = { commentId: COMMENT_ID, reason: 'spam', details: ' text ' };

    test('returns the public write failure and validates input', async () => {
        state.response = Response.json({ code: 'TURNSTILE' }, { status: 403 });
        expect((await send(ok)).status).toBe(403);
        state.response = null;
        expect(await code(await send(null))).toBe('BLOG_COMMENT_REPORT_INVALID_COMMENT_ID');
        expect(await code(await send({ commentId: 'bad', reason: 'spam' }))).toBe(
            'BLOG_COMMENT_REPORT_INVALID_COMMENT_ID'
        );
        expect(await code(await send({ commentId: COMMENT_ID, reason: 'nope' }))).toBe(
            'BLOG_COMMENT_REPORT_INVALID_REASON'
        );
        expect(await code(await send({ commentId: COMMENT_ID }))).toBe(
            'BLOG_COMMENT_REPORT_INVALID_REASON'
        );
    });

    test('requires a salt and storage', async () => {
        state.salt = null;
        expect((await send(ok)).status).toBe(503);
        state.salt = 'salt';
        state.data = undefined;
        expect((await send(ok)).status).toBe(500);
    });

    test('saves reports and maps failures', async () => {
        const response = await send({ ...ok, details: 'd'.repeat(600) });
        expect(response.status).toBe(201);
        expect((state.reports[0] as any[])[1].details).toHaveLength(500);
        expect((state.reports[0] as any[])[1].reporterIpHash).toHaveLength(64);
        await send({ commentId: COMMENT_ID, reason: 'spam', details: '' });
        expect((state.reports[1] as any[])[1].details).toBeNull();
        state.reportOutcome = 'not-found';
        expect((await send(ok)).status).toBe(404);
        state.reportError = true;
        const original = console.error;
        console.error = () => {};
        try {
            expect((await send(ok)).status).toBe(500);
        } finally {
            console.error = original;
        }
    });
});
