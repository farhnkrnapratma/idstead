// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { admin, slot } from './support.ts';

const state = {
    pages: [{ slug: 'terms' }] as unknown[],
    pagesError: false,
    saveResult: { status: 'saved' } as Record<string, unknown>,
    saved: [] as unknown[],
    exportError: false,
    exported: [] as unknown[],
    rows: [
        {
            id: 'a1',
            created_at: '2026-01-02T03:04:05.000Z',
            actor: 'admin@example.com',
            action: 'post.update',
            category: 'content',
            entity_id: 'p1',
            summary: 'Updated a post.',
            ip: '203.0.113.7'
        }
    ] as unknown[],
    total: 1,
    oidc: { ok: true, authTime: 100 } as Record<string, any>,
    enabled: true,
    outcome: { kind: 'redirect', url: 'https://rp.test/cb?code=1' } as Record<string, any>,
    outcomeError: false,
    resolved: [] as unknown[]
};

mock.module('../../packages/lib/src/server/oidc/authorize.ts', () => ({
    resolveAuthorization: async (...args: unknown[]) => {
        state.resolved.push(args);
        if (state.outcomeError) throw new Error('store');
        return state.outcome;
    }
}));
slot.oidcAdmin = async () => state.oidc;
slot.oidcEnabled = () => state.enabled;
slot.oidcEndpoints = () => ({ issuer: 'https://admin.example.com' });

const legal = await import('../../apps/admin/src/routes/api/internal/admin/legal/+server.ts');
const exportRoute =
    await import('../../apps/admin/src/routes/api/internal/admin/activity-log/export/+server.ts');
const authorize =
    await import('../../apps/admin/src/routes/api/internal/admin/oidc/authorize/+server.ts');

function event(init: { path?: string; method?: string; body?: unknown; raw?: string } = {}) {
    const url = new URL(`https://admin.example.com/api/internal/admin/${init.path ?? 'x'}`);
    const method = init.method ?? 'POST';
    return {
        request: new Request(url, {
            method,
            headers: { origin: url.origin },
            body: method === 'GET' ? undefined : (init.raw ?? JSON.stringify(init.body ?? {}))
        }),
        url,
        platform: {},
        getClientAddress: () => '203.0.113.9'
    } as any;
}

async function code(response: Response) {
    return ((await response.json()) as any).code;
}

beforeEach(() => {
    admin.response = null;
    admin.logged = [];
    state.pagesError = false;
    state.saveResult = { status: 'saved' };
    state.saved = [];
    state.exportError = false;
    state.exported = [];
    state.total = 1;
    state.oidc = { ok: true, authTime: 100 };
    state.enabled = true;
    state.outcome = { kind: 'redirect', url: 'https://rp.test/cb?code=1' };
    state.outcomeError = false;
    state.resolved = [];
    admin.service = {
        legal: {
            pages: async () => {
                if (state.pagesError) throw new Error('db');
                return state.pages;
            }
        },
        legalWriter: {
            save: async (input: unknown) => {
                state.saved.push(input);
                return state.saveResult;
            }
        },
        activityLog: {
            export: async (filter: unknown) => {
                if (state.exportError) throw new Error('db');
                state.exported.push(filter);
                return { data: state.rows, total: state.total };
            }
        },
        oidcClients: {},
        oidcAuth: {}
    };
    state.oidc = { ok: true, authTime: 100, service: admin.service };
});

describe('/api/internal/admin/legal', () => {
    const { GET, POST } = legal as any;
    const valid = { slug: 'terms', title: ' Terms ', content: 'Body' };

    test('returns the admin failure response', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await GET(event({ method: 'GET' }))).status).toBe(401);
        expect((await POST(event({ body: valid }))).status).toBe(401);
    });

    test('lists pages and fails closed', async () => {
        const response = await GET(event({ method: 'GET' }));
        expect(await response.json()).toEqual({ pages: state.pages });
        state.pagesError = true;
        const failed = await GET(event({ method: 'GET' }));
        expect(failed.status).toBe(503);
        expect(await code(failed)).toBe('LEGAL_UNAVAILABLE');
    });

    test('rejects invalid input', async () => {
        const cases: unknown[] = [
            { ...valid, slug: 'nope' },
            { ...valid, slug: 1 },
            { ...valid, title: '   ' },
            { ...valid, title: 5 },
            { ...valid, title: 'x'.repeat(201) },
            { ...valid, content: 5 },
            { ...valid, content: '  ' },
            { ...valid, content: 'x'.repeat(200_001) }
        ];
        for (const body of cases) {
            const response = await POST(event({ body }));
            expect(response.status).toBe(400);
            expect(await code(response)).toBe('LEGAL_INVALID_INPUT');
        }
        expect(await code(await POST(event({ raw: '{' })))).toBe('LEGAL_INVALID_INPUT');
        expect(await code(await POST(event({ raw: 'null' })))).toBe('LEGAL_INVALID_INPUT');
        expect(state.saved).toEqual([]);
    });

    test('reports a rejected save', async () => {
        state.saveResult = { status: 'rejected', message: 'Nope.' };
        const response = await POST(event({ body: valid }));
        expect(response.status).toBe(400);
        expect(await code(response)).toBe('LEGAL_SAVE_FAILED');
        expect(admin.logged).toEqual([]);
    });

    test('saves a trimmed page and logs it', async () => {
        const response = await POST(event({ body: valid }));
        expect(await response.json()).toEqual({ success: true });
        expect(state.saved).toEqual([{ slug: 'terms', title: 'Terms', content: 'Body' }]);
        expect(admin.logged[0]).toMatchObject({ action: 'legal.update', entityId: 'terms' });
    });
});

describe('GET /api/internal/admin/activity-log/export', () => {
    const { GET } = exportRoute as any;
    const get = (query = '') => GET(event({ method: 'GET', path: `activity-log/export${query}` }));

    test('returns the admin failure response', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await get()).status).toBe(401);
    });

    test('rejects invalid queries and formats', async () => {
        const query = await get('?category=zzz');
        expect(query.status).toBe(400);
        expect(await code(query)).toBe('ACTIVITY_LOG_INVALID_QUERY');
        const format = await get('?format=csv');
        expect(await code(format)).toBe('ACTIVITY_LOG_INVALID_FORMAT');
    });

    test('fails closed when the export throws', async () => {
        state.exportError = true;
        const response = await get('?format=txt');
        expect(response.status).toBe(503);
        expect(await code(response)).toBe('ACTIVITY_LOG_EXPORT_FAILED');
    });

    test('exports text without paging fields', async () => {
        const response = await get('?format=txt&limit=5&offset=1&query=post');
        expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
        expect(response.headers.get('content-disposition')).toMatch(
            /^attachment; filename="activity-log-\d{4}-\d{2}-\d{2}\.txt"$/
        );
        expect(response.headers.get('x-total-count')).toBe('1');
        expect(response.headers.get('x-export-limit')).toBe('5000');
        expect(await response.text()).toContain('post.update');
        expect(state.exported[0]).toMatchObject({ query: 'post' });
        expect(state.exported[0]).not.toHaveProperty('limit');
        expect(state.exported[0]).not.toHaveProperty('offset');
    });

    test('exports a pdf by default', async () => {
        const response = await get();
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
    });
});

describe('POST /api/internal/admin/oidc/authorize', () => {
    const { POST } = authorize as any;
    const body = { query: '?client_id=c1', decision: 'allow' };
    const post = (input: unknown = body) => POST(event({ path: 'oidc/authorize', body: input }));

    test('returns the oidc admin failure response', async () => {
        state.oidc = { ok: false, response: Response.json({ code: 'NO' }, { status: 401 }) };
        expect((await post()).status).toBe(401);
    });

    test('requires sign in with Idstead to be set up', async () => {
        state.enabled = false;
        const response = await post();
        expect(response.status).toBe(503);
        expect(await code(response)).toBe('OIDC_UNAVAILABLE');
    });

    test('rejects invalid decisions', async () => {
        for (const input of [
            { query: 1, decision: 'allow' },
            { query: 'client_id=c1', decision: 'allow' },
            { query: '?a=1', decision: 'maybe' }
        ])
            expect(await code(await post(input))).toBe('OIDC_AUTHORIZE_INVALID_INPUT');
        const malformed = await POST(event({ path: 'oidc/authorize', raw: '{' }));
        expect(await code(malformed)).toBe('OIDC_AUTHORIZE_INVALID_INPUT');
    });

    test('reports unresolved requests', async () => {
        state.outcome = { kind: 'fatal', message: 'Unknown client.' };
        const fatal = await post();
        expect(fatal.status).toBe(400);
        expect(await code(fatal)).toBe('OIDC_AUTHORIZE_INVALID_REQUEST');
        state.outcome = { kind: 'prompt' };
        const pending = await post();
        expect(((await pending.json()) as any).message).toBe('No decision was made.');
    });

    test('returns the redirect without logging a denial', async () => {
        const response = await post({ ...body, decision: 'deny' });
        expect(await response.json()).toEqual({ redirect: 'https://rp.test/cb?code=1' });
        expect(admin.logged).toEqual([]);
        const [, params, options] = state.resolved[0] as any[];
        expect(params.get('client_id')).toBe('c1');
        expect(options).toEqual({
            issuer: 'https://admin.example.com',
            authTime: 100,
            decision: 'deny'
        });
    });

    test('logs a consent', async () => {
        state.outcome = {
            kind: 'redirect',
            url: 'https://rp.test/cb',
            consented: { clientId: 'c1', name: 'Reader' }
        };
        await post();
        expect(admin.logged[0]).toMatchObject({
            action: 'oidc.consent',
            category: 'security',
            entityId: 'c1'
        });
    });

    test('fails closed when the decision cannot be saved', async () => {
        state.outcomeError = true;
        const response = await post();
        expect(response.status).toBe(503);
        expect(await code(response)).toBe('OIDC_UNAVAILABLE');
    });
});
