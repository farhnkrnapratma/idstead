// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './support.ts';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const row = (status: string) => ({
    id: ID,
    email: 'reader@example.com',
    status,
    created_at: '2026-11-01T00:00:00.000Z',
    confirmed_at: null,
    unsubscribed_at: null
});

const state = {
    rows: [row('pending')] as any[],
    total: 1,
    listed: [] as unknown[],
    listError: false,
    byId: row('pending') as any,
    updated: row('active') as any,
    deleted: 'deleted' as string,
    request: 'requested' as string,
    requested: [] as any[],
    emailOk: true,
    sent: [] as any[],
    storeError: false,
    requestError: false
};

const maybeFail = <T>(value: T) => {
    if (state.storeError) throw new Error('db');
    return value;
};

slots.dataStores = () => ({
    service: {
        adminSubscribers: {
            list: async (query: unknown) => {
                if (state.listError) throw new Error('db');
                state.listed.push(query);
                return { items: state.rows, total: state.total };
            },
            byId: async () => maybeFail(state.byId),
            setStatus: async () => maybeFail(state.updated),
            delete: async () => maybeFail(state.deleted)
        },
        writers: {
            subscribers: {
                request: async (input: unknown) => {
                    if (state.requestError) throw new Error('db');
                    state.requested.push(input);
                    return state.request;
                },
                cancelConfirmation: async () => undefined
            }
        }
    }
});

const list = await import('../../apps/admin/src/routes/api/internal/admin/subscribers/+server.ts');
const item = await import(
    '../../apps/admin/src/routes/api/internal/admin/subscribers/[id]/+server.ts'
);

const realFetch = globalThis.fetch;
const platform = { env: { RESEND_API_KEY: 'key', SUBSCRIBER_FROM_EMAIL: 'Site <s@example.com>' } };

function event(method: string, path: string, body?: unknown, params: Record<string, string> = {}) {
    const url = new URL(`https://admin.example.com/api/internal/admin/subscribers${path}`);
    return {
        request: new Request(url, {
            method,
            headers: { origin: url.origin, 'content-type': 'application/json' },
            body:
                body === undefined
                    ? undefined
                    : typeof body === 'string'
                      ? body
                      : JSON.stringify(body)
        }),
        url,
        params,
        platform,
        getClientAddress: () => '203.0.113.7'
    } as any;
}

const code = async (response: Response) => ((await response.json()) as any).code;

beforeEach(() => {
    admin.authFailure = null;
    admin.logged = [];
    Object.assign(state, {
        rows: [row('pending')],
        total: 1,
        listed: [],
        listError: false,
        byId: row('pending'),
        updated: row('active'),
        deleted: 'deleted',
        request: 'requested',
        requested: [],
        emailOk: true,
        sent: [],
        storeError: false,
        requestError: false
    });
    slot.configuredSiteUrl = () => 'https://example.com';
    slot.publicRepositories = () => ({ author: { profile: async () => ({ name: 'Ada' }) } });
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
        state.sent.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: state.emailOk ? 200 : 500 });
    }) as never;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    delete slot.configuredSiteUrl;
});

describe('GET /api/internal/admin/subscribers', () => {
    test('requires an admin', async () => {
        admin.authFailure = Response.json({ code: 'ADMIN_FORBIDDEN' }, { status: 403 });
        expect((await list.GET(event('GET', ''))).status).toBe(403);
    });

    test('lists a page with search and status filters without caching', async () => {
        const response = await list.GET(event('GET', '?q=reader&status=pending&page=2'));
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            items: state.rows,
            total: 1,
            page: 2,
            pageSize: 25
        });
        expect(state.listed[0]).toEqual({ query: 'reader', status: 'pending', page: 2, limit: 25 });
        await list.GET(event('GET', ''));
        expect(state.listed[1]).toEqual({
            query: undefined,
            status: undefined,
            page: 1,
            limit: 25
        });
    });

    test('rejects bad parameters and reports storage failures', async () => {
        expect(await code(await list.GET(event('GET', `?q=${'a'.repeat(255)}`)))).toBe(
            'SUBSCRIBERS_QUERY_INVALID'
        );
        expect(await code(await list.GET(event('GET', '?status=gone')))).toBe(
            'SUBSCRIBERS_STATUS_INVALID'
        );
        for (const page of ['0', '-1', 'x', '1.5'])
            expect(await code(await list.GET(event('GET', `?page=${page}`)))).toBe(
                'SUBSCRIBERS_PAGE_INVALID'
            );
        state.listError = true;
        const original = console.error;
        console.error = () => {};
        expect(await code(await list.GET(event('GET', '')))).toBe('SUBSCRIBERS_UNAVAILABLE');
        console.error = original;
    });
});

describe('POST /api/internal/admin/subscribers', () => {
    test('requires a same-origin admin and a valid email', async () => {
        admin.authFailure = Response.json({ code: 'FORBIDDEN_ORIGIN' }, { status: 403 });
        expect((await list.POST(event('POST', '', { email: 'a@b.co' }))).status).toBe(403);
        admin.authFailure = null;
        expect(await code(await list.POST(event('POST', '', 'nope')))).toBe(
            'SUBSCRIBER_EMAIL_INVALID'
        );
        expect(await code(await list.POST(event('POST', '', { email: 'bad' })))).toBe(
            'SUBSCRIBER_EMAIL_INVALID'
        );
    });

    test('sends a confirmation link to the public site and logs the action', async () => {
        const response = await list.POST(event('POST', '', { email: ' New@Example.com ' }));
        expect(response.status).toBe(202);
        expect(state.requested[0]).toMatchObject({
            email: 'new@example.com',
            ipHash: null,
            userAgent: ''
        });
        expect(state.sent[0].to).toEqual(['new@example.com']);
        expect(state.sent[0].text).toContain('https://example.com/subscribe/confirm?token=');
        expect(admin.logged[0]).toMatchObject({ action: 'newsletter.subscriber_add' });
        expect(JSON.stringify(admin.logged[0])).not.toContain('new@example.com');
    });

    test('maps each outcome to an error', async () => {
        const post = () => list.POST(event('POST', '', { email: 'a@b.co' }));
        state.request = 'already-active';
        expect(await code(await post())).toBe('SUBSCRIBER_EXISTS');
        state.request = 'cooling-down';
        expect((await post()).status).toBe(429);
        state.request = 'requested';
        state.emailOk = false;
        const original = console.error;
        console.error = () => {};
        expect(await code(await post())).toBe('SUBSCRIBER_EMAIL_FAILED');
        console.error = original;
        state.requestError = true;
        expect(((await (await post()).json()) as any).message).toBe(
            'The subscriber could not be saved right now.'
        );
        state.requestError = false;
        slot.configuredSiteUrl = () => {
            throw new Error('PUBLIC_SITE_URL is not configured.');
        };
        expect(await code(await post())).toBe('SUBSCRIBERS_UNAVAILABLE');
        slot.configuredSiteUrl = () => 'https://example.com';
        platform.env.RESEND_API_KEY = '';
        expect(await code(await post())).toBe('SUBSCRIBERS_UNAVAILABLE');
        platform.env.RESEND_API_KEY = 'key';
        expect(admin.logged).toHaveLength(0);
    });
});

describe('PATCH /api/internal/admin/subscribers/[id]', () => {
    const patch = (body: unknown, id = ID) => item.PATCH(event('PATCH', `/${id}`, body, { id }));

    test('requires an admin, a known id and a valid body', async () => {
        admin.authFailure = Response.json({ code: 'FORBIDDEN_ORIGIN' }, { status: 403 });
        expect((await patch({ status: 'active' })).status).toBe(403);
        admin.authFailure = null;
        expect(await code(await patch({ status: 'active' }, 'nope'))).toBe('SUBSCRIBER_NOT_FOUND');
        state.byId = null;
        expect(await code(await patch({ status: 'active' }))).toBe('SUBSCRIBER_NOT_FOUND');
        state.byId = row('active');
        expect(await code(await patch({ status: 'pending' }))).toBe('SUBSCRIBER_UPDATE_INVALID');
        expect(await code(await patch('nope'))).toBe('SUBSCRIBER_UPDATE_INVALID');
    });

    test('reports storage failures while switching status', async () => {
        state.byId = row('active');
        const original = console.error;
        console.error = () => {};
        const realSet = state.updated;
        state.updated = row('unsubscribed');
        let calls = 0;
        const { service } = slots.dataStores();
        const set = service.adminSubscribers.setStatus;
        service.adminSubscribers.setStatus = async () => {
            calls++;
            throw new Error('db');
        };
        const stores = slots.dataStores;
        slots.dataStores = () => ({ service });
        expect(await code(await patch({ status: 'unsubscribed' }))).toBe('SUBSCRIBERS_UNAVAILABLE');
        expect(calls).toBe(1);
        slots.dataStores = stores;
        service.adminSubscribers.setStatus = set;
        state.updated = realSet;
        console.error = original;
    });

    test('switches status and reports conflicts', async () => {
        state.byId = row('unsubscribed');
        const response = await patch({ status: 'active' });
        expect(await response.json()).toEqual({ subscriber: row('active') });
        expect(admin.logged[0]).toMatchObject({
            action: 'newsletter.subscriber_activate',
            entityId: ID
        });
        state.updated = row('unsubscribed');
        await patch({ status: 'unsubscribed' });
        expect(admin.logged[1]).toMatchObject({ action: 'newsletter.subscriber_unsubscribe' });
        state.updated = null;
        const activate = await patch({ status: 'active' });
        expect(activate.status).toBe(409);
        expect(((await activate.json()) as any).message).toContain('confirmed before');
        expect(((await (await patch({ status: 'unsubscribed' })).json()) as any).message).toContain(
            'Only active'
        );
    });

    test('resends the confirmation only for pending subscribers', async () => {
        const response = await patch({ action: 'resend' });
        expect(response.status).toBe(200);
        expect(state.requested[0]).toMatchObject({ email: 'reader@example.com' });
        expect(admin.logged[0]).toMatchObject({ action: 'newsletter.subscriber_resend' });
        const original = console.error;
        console.error = () => {};
        state.storeError = true;
        expect(await code(await patch({ action: 'resend' }))).toBe('SUBSCRIBERS_UNAVAILABLE');
        state.storeError = false;
        console.error = original;
        state.request = 'cooling-down';
        expect(await code(await patch({ action: 'resend' }))).toBe('SUBSCRIBER_COOLDOWN');
        state.byId = row('active');
        expect(await code(await patch({ action: 'resend' }))).toBe('SUBSCRIBER_NOT_PENDING');
    });
});

describe('DELETE /api/internal/admin/subscribers/[id]', () => {
    const remove = (id = ID) => item.DELETE(event('DELETE', `/${id}`, undefined, { id }));

    test('deletes a subscriber and logs it', async () => {
        admin.authFailure = Response.json({ code: 'FORBIDDEN_ORIGIN' }, { status: 403 });
        expect((await remove()).status).toBe(403);
        admin.authFailure = null;
        expect(await code(await remove('nope'))).toBe('SUBSCRIBER_NOT_FOUND');
        expect((await remove()).status).toBe(204);
        expect(admin.logged[0]).toMatchObject({
            action: 'newsletter.subscriber_delete',
            entityId: ID
        });
        state.storeError = true;
        const original = console.error;
        console.error = () => {};
        expect(await code(await remove())).toBe('SUBSCRIBERS_UNAVAILABLE');
        state.storeError = false;
        state.deleted = 'not-found';
        expect(await code(await remove())).toBe('SUBSCRIBER_NOT_FOUND');
        console.error = original;
    });
});
