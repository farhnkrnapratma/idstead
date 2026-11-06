// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = { service: undefined as unknown, auth: { status: 0 } as Record<string, unknown> };

mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: state.service })
}));
mock.module('../packages/lib/src/server/blogPostAuth.ts', () => ({
    blogAdmin: async () => state.auth
}));

const { adminActivity } = await import('../packages/lib/src/server/adminActivity.ts');

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const UUID2 = '1f8fad5b-d9cb-469f-a165-70867728950e';

function input(method: string, query = '', body?: unknown, headers: Record<string, string> = {}) {
    const url = new URL('https://admin.test/api/internal/admin/activity?' + query);
    return {
        url,
        request: new Request(url, {
            method,
            headers: { 'content-type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
        platform: {}
    };
}

const calls: Array<[string, unknown]> = [];
const record = (name: string, value: unknown) => async (arg?: unknown) => {
    calls.push([name, arg]);
    return value;
};

const store = {
    clearNotifications: async (arg: { confirm: boolean }) => {
        calls.push(['clearNotifications', arg]);
        return { status: 'ok', result: { cleared: arg.confirm } } as Record<string, unknown>;
    },
    markRead: record('markRead', true),
    remove: record('remove', true),
    setPinned: async (id: string, pinned: boolean) => {
        calls.push(['setPinned', [id, pinned]]);
        return true;
    },
    markAllRead: record('markAllRead', 3),
    inbox: record('inbox', { items: [] }),
    dashboard: record('dashboard', { stats: true }),
    subscriberStats: record('subscriberStats', { subscribers: 1 }),
    feedbackGroups: record('feedbackGroups', { groups: [] }),
    feedbackHistory: record('feedbackHistory', { history: [] }),
    reportGroups: record('reportGroups', { reports: [] }),
    reportHistory: record('reportHistory', { events: [] })
};

beforeEach(() => {
    calls.length = 0;
    state.service = { adminActivity: store };
    state.auth = { status: 0, actor: 'admin' };
});

const json = async (response: Response) => (await response.json()) as Record<string, unknown>;
const code = async (response: Response) => JSON.stringify(await response.json());

describe('adminActivity access', () => {
    test('is unavailable without a service', async () => {
        state.service = undefined;
        expect((await adminActivity(input('GET'), false)).status).toBe(503);
    });

    test('relays authentication failures', async () => {
        state.auth = { status: 401, code: 'NOPE', message: 'denied' };
        const denied = await adminActivity(input('GET'), false);
        expect(denied.status).toBe(401);
        expect(await code(denied)).toContain('NOPE');
        state.auth = { status: 403, message: 'denied' };
        const fallback = await adminActivity(input('GET'), false);
        expect(await code(fallback)).toContain('ADMIN_ACTIVITY_AUTH_REQUIRED');
    });

    test('rejects other methods and non-inbox posts', async () => {
        expect((await adminActivity(input('PUT', '', {}), true)).status).toBe(405);
        expect((await adminActivity(input('POST', '', {}), false)).status).toBe(405);
    });

    test('maps unexpected failures to unavailable', async () => {
        state.service = {
            adminActivity: {
                ...store,
                dashboard: async () => {
                    throw new Error('boom');
                }
            }
        };
        const response = await adminActivity(input('GET'), false);
        expect(response.status).toBe(503);
        expect(await code(response)).toContain('ADMIN_ACTIVITY_UNAVAILABLE');
    });
});

describe('adminActivity inbox actions', () => {
    test('prepares and confirms a clear', async () => {
        const prepared = await adminActivity(
            input('POST', '', { action: 'prepare_clear', operationId: UUID }),
            true
        );
        expect(await json(prepared)).toEqual({ cleared: false });
        const cleared = await adminActivity(
            input('POST', '', { action: 'clear', operationId: UUID }),
            true
        );
        expect(await json(cleared)).toEqual({ cleared: true });
        expect(calls[1][1]).toEqual({ actorId: 'admin', operationId: UUID, confirm: true });
        expect(prepared.headers.get('cache-control')).toBe('no-store');
    });

    test('reports a clear conflict', async () => {
        state.service = {
            adminActivity: { ...store, clearNotifications: async () => ({ status: 'conflict' }) }
        };
        const response = await adminActivity(
            input('POST', '', { action: 'clear', operationId: UUID }),
            true
        );
        expect(response.status).toBe(409);
        expect(await code(response)).toContain('ADMIN_CLEAR_CONFLICT');
    });

    test('marks read, deletes, pins and unpins', async () => {
        expect(
            await json(await adminActivity(input('POST', '', { action: 'read', id: UUID }), true))
        ).toEqual({ updated: true });
        expect(
            await json(await adminActivity(input('POST', '', { action: 'delete', id: UUID }), true))
        ).toEqual({ updated: true });
        await adminActivity(input('POST', '', { action: 'pin', id: UUID }), true);
        await adminActivity(input('POST', '', { action: 'unpin', id: UUID }), true);
        expect(
            await json(await adminActivity(input('POST', '', { action: 'read_all' }), true))
        ).toEqual({ updated: 3 });
        expect(calls.map(([name]) => name)).toEqual([
            'markRead',
            'remove',
            'setPinned',
            'setPinned',
            'markAllRead'
        ]);
        expect(calls[2][1]).toEqual([UUID, true]);
        expect(calls[3][1]).toEqual([UUID, false]);
    });

    test('rejects invalid actions and bodies', async () => {
        for (const body of [
            { action: 'bogus' },
            { action: 'read', id: 'bad' },
            { action: 'clear', operationId: 'bad' }
        ]) {
            expect((await adminActivity(input('POST', '', body), true)).status).toBe(400);
        }
        expect(
            (await adminActivity(input('POST', '', {}, { 'content-type': 'text/plain' }), true))
                .status
        ).toBe(415);
    });
});

describe('adminActivity inbox listing', () => {
    test('queries with defaults', async () => {
        await adminActivity(input('GET'), true);
        expect(calls[0][1]).toEqual({
            query: '',
            type: 'all',
            read: 'all',
            sort: 'date',
            direction: 'desc',
            cursor: null
        });
    });

    test('passes filters and a normalised cursor', async () => {
        const cursor = JSON.stringify({ value: 'v', date: '2026-01-01T00:00:00Z', id: UUID2 });
        await adminActivity(
            input(
                'GET',
                new URLSearchParams({
                    query: 'hi',
                    type: 'helpful',
                    read: 'unread',
                    sort: 'page',
                    direction: 'asc',
                    cursor
                }).toString()
            ),
            true
        );
        expect(calls[0][1]).toEqual({
            query: 'hi',
            type: 'helpful',
            read: 'unread',
            sort: 'page',
            direction: 'asc',
            cursor: { value: 'v', date: '2026-01-01T00:00:00.000Z', id: UUID2 }
        });
    });

    test('rejects invalid filters and cursors', async () => {
        const bad = (params: Record<string, string>) =>
            adminActivity(input('GET', new URLSearchParams(params).toString()), true);
        const badCursors = [
            'x'.repeat(2001),
            'not json',
            'null',
            JSON.stringify({ value: 1, date: '2026-01-01' }),
            JSON.stringify({ value: 'x'.repeat(1001), date: '2026-01-01' }),
            JSON.stringify({ value: 'v', date: 5 }),
            JSON.stringify({ value: 'v', date: 'garbage' }),
            JSON.stringify({ value: 'v', date: '2026-01-01', id: 'bad' })
        ];
        for (const cursor of badCursors) expect((await bad({ cursor })).status).toBe(400);
        const filters: Array<Record<string, string>> = [
            { query: 'x'.repeat(201) },
            { type: 'bogus' },
            { read: 'bogus' },
            { sort: 'bogus' },
            { direction: 'bogus' }
        ];
        for (const params of filters) expect((await bad(params)).status).toBe(400);
        expect(calls).toHaveLength(0);
    });
});

describe('adminActivity sections', () => {
    const get = (query: string) => adminActivity(input('GET', query), false);

    test('serves stats by default and subscribers', async () => {
        expect(await json(await get(''))).toEqual({ stats: true });
        expect(await json(await get('section=subscribers'))).toEqual({ subscribers: 1 });
    });

    test('serves feedback groups with and without a target', async () => {
        await get('section=feedback&offset=20');
        expect(calls[0]).toEqual(['feedbackGroups', { offset: 20, page: null }]);
        await get(`section=feedback&targetType=article&targetId=${UUID}`);
        expect(calls[1][1]).toEqual({ offset: 0, page: { type: 'article', id: UUID } });
    });

    test('serves feedback history for a target', async () => {
        await get(`section=feedback_history&targetType=legal&targetId=privacy&focusId=${UUID}`);
        expect(calls[0]).toEqual([
            'feedbackHistory',
            { offset: 0, page: { type: 'legal', id: 'privacy' }, focusId: UUID }
        ]);
        expect((await get('section=feedback_history')).status).toBe(400);
        expect((await get(`section=feedback&targetType=other&targetId=${UUID}`)).status).toBe(400);
    });

    test('serves report groups and report history', async () => {
        await get(`section=reports&postId=${UUID}`);
        expect(calls[0]).toEqual(['reportGroups', { offset: 0, postId: UUID, focusId: null }]);
        await get(`section=report_history&commentId=${UUID}&reason=spam_ad&offset=5`);
        expect(calls[1][1]).toEqual({
            commentId: UUID,
            reason: 'spam_ad',
            offset: 5,
            focusId: null
        });
        await get(`section=report_history&commentId=${UUID}`);
        expect((calls[2][1] as { reason: unknown }).reason).toBeNull();
    });

    test('rejects invalid parameters', async () => {
        for (const query of [
            'section=bogus',
            'offset=abc',
            'offset=1234567890',
            'focusId=bad',
            'postId=bad&section=reports',
            'section=report_history',
            `section=report_history&commentId=${UUID}&reason=${'a'.repeat(81)}`,
            `section=report_history&commentId=${UUID}&reason=BAD-1`
        ]) {
            expect((await get(query)).status).toBe(400);
        }
    });
});
