// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = { response: null as Response | null, failure: false, requests: [] as string[] };

mock.module('../apps/admin/src/lib/adminClient.ts', () => ({
    adminFetch: async (path: string) => {
        state.requests.push(path);
        if (state.failure) throw new Error('offline');
        return state.response as Response;
    }
}));

const { mdrsContent } = await import('../apps/admin/src/lib/mdrsValidation.ts');

const check = mdrsContent('Body');

beforeEach(() => {
    state.response = null;
    state.failure = false;
    state.requests = [];
});

describe('mdrsContent', () => {
    test('requires text before asking the server', async () => {
        expect(await check('   ')).toBe('Body is required.');
        expect(state.requests).toEqual([]);
    });

    test('accepts text the server validates', async () => {
        state.response = new Response('{}', { status: 200 });
        expect(await check('# Hello')).toBe('');
        expect(state.requests).toEqual(['/api/internal/blog/validate-define']);
    });

    test('ignores network failures and other statuses', async () => {
        state.failure = true;
        expect(await check('# Hello')).toBe('');
        state.failure = false;
        state.response = new Response('{}', { status: 500 });
        expect(await check('# Hello')).toBe('');
    });

    test('reports the first messages and how many more there are', async () => {
        state.response = Response.json(
            { code: 'BLOG_DEFINE_VALIDATION_FAILED', details: 'one\ntwo\nthree\nfour' },
            { status: 422 }
        );
        expect(await check('# Hello')).toBe('one · two · three (+1 more)');
    });

    test('reads messages from a nested error and splits the separator', async () => {
        state.response = Response.json({ error: { message: 'first | second' } }, { status: 422 });
        expect(await check('# Hello')).toBe('first · second');
    });

    test('falls back to a generic message when the body has no messages', async () => {
        state.response = new Response('not json', { status: 422 });
        expect(await check('# Hello')).toBe('The document has MDRS errors.');
    });
});
