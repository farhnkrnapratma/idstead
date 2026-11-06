// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { REPORT_REASONS } from '../packages/lib/src/reportReasons.ts';

mock.module('$app/env/public', () => ({}));

const state = {
    service: undefined as unknown,
    auth: { status: 0 } as Record<string, unknown>,
    logged: [] as unknown[]
};

mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: state.service })
}));
mock.module('../packages/lib/src/server/blogPostAuth.ts', () => ({
    blogAdmin: async () => state.auth
}));
mock.module('../packages/lib/src/server/activityLog.ts', () => ({
    clientAddress: (get?: () => string) => get?.() ?? 'unknown',
    logActivity: async (entry: unknown) => void state.logged.push(entry)
}));
mock.module('../packages/lib/src/server/ipSalt.ts', () => ({ ipSalt: () => 'salt' }));

const { adminWorkspace, workspaceOptions } =
    await import('../packages/lib/src/server/adminWorkspace.ts');

const NOW = new Date('2026-06-15T12:00:00.000Z');
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const options = (query: string) => workspaceOptions(new URLSearchParams(query), NOW);
const rejects = (query: string, message: string) => expect(() => options(query)).toThrow(message);

describe('workspaceOptions', () => {
    test('defaults per section', () => {
        const overview = options('');
        expect(overview.section).toBe('overview');
        expect(overview.options).toMatchObject({
            range: '7d',
            type: 'all',
            read: 'all',
            vote: 'all',
            sort: 'date',
            direction: 'desc',
            meta: true,
            events: true,
            page: 1
        });
        expect(overview.options.from).toBe('2026-06-08T12:00:00.000Z');
        expect(options('section=reports').options).toMatchObject({ range: 'all', from: null });
        expect(options('section=comments&id=' + UUID).options.range).toBe('all');
        expect(options('preview=true&history=false&meta=false').options).toMatchObject({
            limit: 5,
            events: false,
            meta: false
        });
    });

    test('computes year, custom and explicit periods', () => {
        expect(options('range=1y').options.from).toBe('2025-06-15T12:00:00.000Z');
        expect(
            options('range=custom&from=2026-05-01T00:00:00Z&to=2026-06-01T00:00:00Z').options
        ).toMatchObject({ from: '2026-05-01T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' });
        expect(options('range=30d&to=2026-06-01T00:00:00Z').options.from).toBe(
            '2026-05-02T00:00:00.000Z'
        );
        expect(options('timeZone=Asia/Jakarta&asOf=2026-06-15T11:00:00Z').options).toMatchObject({
            timeZone: 'Asia/Jakarta',
            asOf: '2026-06-15T11:00:00.000Z'
        });
    });

    test('accepts valid filters and identifiers', () => {
        const reason = REPORT_REASONS[0].id;
        const result = options(
            `section=report_events&id=${UUID}&reason=${reason}&postId=${UUID}&notificationId=${UUID}&focus=${UUID}&query=%20hi%20&page=3&type=article&read=unread&vote=yes&sort=total&direction=asc`
        );
        expect(result.options).toMatchObject({
            reason,
            query: 'hi',
            page: 3,
            type: 'article',
            read: 'unread',
            vote: 'yes',
            sort: 'total',
            direction: 'asc',
            id: UUID,
            notificationId: UUID,
            focus: UUID
        });
        expect(options('section=feedback_events&id=anything').options.id).toBe('anything');
    });

    test('rejects invalid input', () => {
        rejects('section=nope', 'Invalid section.');
        rejects('timeZone=Not/AZone', 'Invalid time zone.');
        rejects('range=forever', 'Invalid range.');
        rejects('section=overview&range=all', 'Choose an analytics period of up to one year.');
        rejects('to=garbage', 'Invalid date.');
        rejects('range=custom', 'Choose both dates.');
        rejects('range=custom&from=2026-06-01T00:00:00Z', 'Choose both dates.');
        rejects('to=2027-06-15T12:00:00Z', 'Choose a valid period');
        rejects(
            'range=custom&from=2026-06-02T00:00:00Z&to=2026-06-01T00:00:00Z',
            'Choose a valid period'
        );
        rejects(
            'range=custom&from=2024-01-01T00:00:00Z&to=2026-06-01T00:00:00Z',
            'Choose a valid period'
        );
        rejects(`query=${'x'.repeat(201)}`, 'Search is too long.');
        rejects('reason=bogus', 'Invalid report category.');
        rejects(`id=${'x'.repeat(1501)}`, 'Invalid target.');
        rejects('section=report_events&id=bad', 'A valid ID is required.');
        rejects('section=notification_events', 'A target is required.');
        rejects('page=0', 'Invalid page.');
        rejects('page=12345', 'Invalid page.');
        rejects('asOf=2027-01-01T00:00:00Z', 'Invalid snapshot.');
        rejects('postId=bad', 'A valid ID is required.');
        rejects('type=bogus', 'Invalid type.');
    });
});

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
    const url = new URL('https://admin.test/api/internal/admin/workspace?section=summary');
    return {
        url,
        request: new Request(url, {
            method,
            headers: { 'content-type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
        platform: {},
        getClientAddress: () => '203.0.113.9'
    };
}

const store = {
    workspace: async (section: string, options: unknown) => ({ section, options }),
    deleteComment: async (id: string) => ({ deleted: id }),
    notificationGroupAction: async (input: unknown) => ({ ok: true, input })
};

beforeEach(() => {
    state.service = { adminActivity: store, activityLog: {} };
    state.auth = { status: 0, actor: 'admin' };
    state.logged = [];
});

describe('adminWorkspace', () => {
    test('reports an unavailable service and failed authentication', async () => {
        state.service = undefined;
        expect((await adminWorkspace(request('GET'))).status).toBe(503);
        state.service = { adminActivity: store, activityLog: {} };
        state.auth = { status: 401, code: 'NOPE', message: 'denied' };
        expect((await adminWorkspace(request('GET'))).status).toBe(401);
        state.auth = { status: 403, message: 'denied' };
        const response = await adminWorkspace(request('GET'));
        expect(response.status).toBe(403);
        expect(await response.text()).toContain('ADMIN_WORKSPACE_AUTH_REQUIRED');
    });

    test('serves GET workspace data and rejects other methods', async () => {
        const response = await adminWorkspace(request('GET'));
        expect(response.headers.get('cache-control')).toBe('no-store');
        const body = (await response.json()) as { section: string; scope: object };
        expect(body.section).toBe('summary');
        expect(body.scope).toHaveProperty('to');
        expect((await adminWorkspace(request('PUT', {}))).status).toBe(405);
        state.service = {
            adminActivity: { ...store, workspace: async () => null },
            activityLog: {}
        };
        expect(await (await adminWorkspace(request('GET'))).json()).toBeNull();
    });

    test('deletes a comment and logs it', async () => {
        const response = await adminWorkspace(
            request('POST', { action: 'delete_comment', id: UUID })
        );
        expect(await response.json()).toEqual({ deleted: UUID });
        expect(state.logged).toHaveLength(1);
        expect(state.logged[0]).toMatchObject({
            action: 'blog.comment_delete',
            ip: '203.0.113.9',
            ipSalt: 'salt'
        });
    });

    test('runs notification group actions with a validated snapshot', async () => {
        const base = { id: 'group-1', asOf: '2026-01-01T00:00:00Z', timeZone: 'Asia/Jakarta' };
        const read = await adminWorkspace(
            request('POST', {
                ...base,
                action: 'read_group',
                from: '2026-01-01T00:00:00Z',
                to: '2026-02-01T00:00:00Z'
            })
        );
        expect(await read.json()).toMatchObject({
            input: { remove: false, timeZone: 'Asia/Jakarta', from: '2026-01-01T00:00:00.000Z' }
        });
        const removal = await adminWorkspace(request('POST', { ...base, action: 'delete_group' }));
        expect(await removal.json()).toMatchObject({
            input: { remove: true, from: null, to: null }
        });
        for (const body of [
            { ...base, action: 'bogus' },
            { ...base, action: 'read_group', id: 5 },
            { ...base, action: 'read_group', id: 'x'.repeat(1501) },
            { ...base, action: 'read_group', asOf: 'garbage' },
            { ...base, action: 'read_group', asOf: '2999-01-01T00:00:00Z' }
        ]) {
            expect((await adminWorkspace(request('POST', body))).status).toBe(400);
        }
        expect(
            (
                await adminWorkspace(
                    request('POST', { action: 'read_group', id: 'g', asOf: '2026-01-01T00:00:00Z' })
                )
            ).status
        ).toBe(200);
    });

    test('maps input and store errors to responses', async () => {
        expect(
            (await adminWorkspace(request('POST', { action: 'delete_comment', id: 'bad' }))).status
        ).toBe(400);
        const wrongType = request('POST', {}, { 'content-type': 'text/plain' });
        expect((await adminWorkspace(wrongType)).status).toBe(415);
        state.service = {
            adminActivity: {
                ...store,
                workspace: async () => {
                    throw new Error('boom');
                }
            },
            activityLog: {}
        };
        const failed = await adminWorkspace(request('GET'));
        expect(failed.status).toBe(503);
        expect(await failed.text()).toContain('ADMIN_WORKSPACE_UNAVAILABLE');
    });
});
