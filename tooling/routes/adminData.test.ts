// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './support.ts';

const state = {
    auth: { status: 0, authTime: Math.floor(Date.now() / 1000) } as Record<string, any>,
    service: undefined as any,
    plan: { documents: ['a.pdf'], posts: [{ id: 'p1' }], identityVersions: ['v1'] } as any,
    planError: false,
    deleteResume: true,
    removeCanonicalError: false,
    syncError: false,
    removeAssetsError: false,
    clearError: false,
    cleanup: { cleanupPending: false } as any,
    cleanupError: false,
    calls: [] as string[],
    oidc: { ok: true } as any,
    clients: [] as any[],
    listError: false,
    enabled: true,
    clientStore: {} as Record<string, any>
};

slots.dataStores = () => ({ service: state.service });
slots.cleanupBlogAssets = async () => {
    if (state.cleanupError) throw new Error('sweep');
    return state.cleanup;
};
slot.verifyAdminRequest = async () => state.auth;
slot.deleteResumeFile = async () => state.deleteResume;
slot.removeCanonicalIdentity = async () => {
    if (state.removeCanonicalError) throw new Error('identity');
};
slot.removeAssets = async (_p: unknown, version: string) => {
    if (state.removeAssetsError) throw new Error('assets');
    state.calls.push(`remove:${version}`);
};
slot.syncPostAssets = async () => {
    if (state.syncError) throw new Error('sync');
    state.calls.push('sync');
};
slot.oidcAdmin = async () => state.oidc;
slot.oidcEnabled = () => state.enabled;
slot.oidcEndpoints = () => ({ issuer: 'https://admin.example.com' });

const deleteAll =
    await import('../../apps/admin/src/routes/api/internal/admin/data/delete-all/+server.ts');
const clients =
    await import('../../apps/admin/src/routes/api/internal/admin/oidc/clients/+server.ts');

function event(init: { body?: unknown; raw?: string; origin?: string } = {}) {
    const url = new URL('https://admin.example.com/api/internal/admin/x');
    return {
        request: new Request(url, {
            method: 'POST',
            headers: { origin: init.origin ?? url.origin, 'content-type': 'application/json' },
            body: init.raw ?? JSON.stringify(init.body ?? {})
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
    admin.logged.length = 0;
    state.auth = { status: 0, authTime: Math.floor(Date.now() / 1000) };
    state.plan = { documents: ['a.pdf'], posts: [{ id: 'p1' }], identityVersions: ['v1'] };
    state.planError = false;
    state.deleteResume = true;
    state.removeCanonicalError = false;
    state.syncError = false;
    state.removeAssetsError = false;
    state.clearError = false;
    state.cleanup = { cleanupPending: false };
    state.cleanupError = false;
    state.calls = [];
    state.oidc = { ok: true };
    state.clients = [];
    state.listError = false;
    state.enabled = true;
    state.service = {
        siteData: {
            deletionPlan: async () => {
                if (state.planError) throw new Error('plan');
                return state.plan;
            },
            clearAll: async () => {
                if (state.clearError) throw new Error('clear');
                state.calls.push('clear');
            }
        },
        resumeDocuments: {},
        adminPosts: {},
        adminAuthor: {
            deleteIdentityVersion: async (v: string) => void state.calls.push(`forget:${v}`)
        }
    };
    state.oidc = { ok: true, service: { oidcClients: makeClients() } };
});

describe('POST /api/internal/admin/data/delete-all', () => {
    const post = (
        body: unknown = { confirm: 'DELETE' },
        init: { raw?: string; origin?: string } = {}
    ) => (deleteAll.POST as any)(event({ body, ...init })) as Promise<Response>;

    test('guards origin, admin, storage and confirmation', async () => {
        expect((await post(undefined, { origin: 'https://evil.example' })).status).toBe(403);
        state.auth = { status: 401, message: 'no' };
        expect(await code(await post())).toBe('ADMIN_AUTH_REQUIRED');
        state.auth = { status: 0, authTime: Math.floor(Date.now() / 1000) };
        const service = state.service;
        state.service = undefined;
        expect((await post()).status).toBe(503);
        state.service = service;
        expect(await code(await post({ confirm: 'delete' }))).toBe(
            'DATA_DELETE_CONFIRMATION_REQUIRED'
        );
        expect(await code(await post({ confirm: 5 }))).toBe('DATA_DELETE_CONFIRMATION_REQUIRED');
        expect(await code(await post(null, { raw: '{nope' }))).toBe(
            'DATA_DELETE_CONFIRMATION_REQUIRED'
        );
        state.auth = { status: 0, authTime: Math.floor(Date.now() / 1000) - 601 };
        expect(await code(await post())).toBe('ADMIN_REAUTH_REQUIRED');
    });

    test('stops when the plan cannot be loaded', async () => {
        state.planError = true;
        const response = await post();
        expect(response.status).toBe(503);
        expect(state.calls).toEqual([]);
    });

    test('removes files, clears data and logs the deletion', async () => {
        const response = await post();
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(state.calls).toEqual(['sync', 'remove:v1', 'forget:v1', 'clear']);
        expect(admin.logged.at(-1)!.summary).toBe('Deleted all site data.');
        state.cleanup = { cleanupPending: true };
        await post();
        expect(admin.logged.at(-1)!.summary).toContain('still need cleanup');
        state.cleanup = { cleanupPending: false };
        state.cleanupError = true;
        await quiet(() => post());
        expect(admin.logged.at(-1)!.summary).toContain('still need cleanup');
    });

    test('keeps the data when any file cleanup fails', async () => {
        for (const failure of [
            'deleteResume',
            'removeCanonicalError',
            'syncError',
            'removeAssetsError'
        ] as const) {
            Object.assign(state, {
                deleteResume: true,
                removeCanonicalError: false,
                syncError: false,
                removeAssetsError: false
            });
            (state as any)[failure] = failure === 'deleteResume' ? false : true;
            state.calls = [];
            const response = await quiet(() => post());
            expect(await code(response)).toBe('DATA_DELETE_CLEANUP_FAILED');
            expect(state.calls).not.toContain('clear');
            expect(admin.logged.at(-1)!.summary).toContain('some uploaded files');
        }
    });

    test('reports a failed final clear', async () => {
        state.clearError = true;
        const response = await post();
        expect(response.status).toBe(503);
        expect(await code(response)).toBe('DATA_DELETE_FAILED');
        expect(admin.logged.at(-1)!.summary).toContain('was not cleared');
    });
});

function makeClients() {
    return {
        list: async () => {
            if (state.listError) throw new Error('db');
            return state.clients;
        },
        create: async (input: any) => ({ clientId: input.clientId, name: input.name }),
        update: async (id: string, input: any) =>
            state.clientStore[id] ? { clientId: id, name: input.name } : null,
        setSecretHash: async (id: string) => Boolean(state.clientStore[id]),
        delete: async (id: string) => Boolean(state.clientStore[id])
    };
}

describe('/api/internal/admin/oidc/clients', () => {
    const get = () => (clients.GET as any)(event()) as Promise<Response>;
    const post = (body: unknown, raw?: string) =>
        (clients.POST as any)(event({ body, raw })) as Promise<Response>;

    test('lists apps and reports outages', async () => {
        state.clients = [{ clientId: 'c1' }];
        const body = (await (await get()).json()) as any;
        expect(body).toMatchObject({
            enabled: true,
            issuer: 'https://admin.example.com',
            discoveryUrl: 'https://admin.example.com/.well-known/openid-configuration',
            clients: [{ clientId: 'c1' }]
        });
        state.listError = true;
        expect((await quiet(get)).status).toBe(503);
        state.oidc = { ok: false, response: Response.json({ code: 'NO' }, { status: 401 }) };
        expect((await get()).status).toBe(401);
        expect((await post({})).status).toBe(401);
    });

    test('creates confidential and public apps', async () => {
        const created = await post({
            action: 'create',
            name: 'Notes',
            redirectUris: ['https://notes.example.com/callback']
        });
        expect(created.status).toBe(201);
        const body = (await created.json()) as any;
        expect(body.clientSecret).toBeTruthy();
        const pub = (await (
            await post({
                action: 'create',
                name: 'Public',
                redirectUris: ['https://p.example.com/callback'],
                confidential: false
            })
        ).json()) as any;
        expect(pub.clientSecret).toBeNull();
        expect(admin.logged.map(entry => entry.action)).toEqual([
            'oidc.client.create',
            'oidc.client.create'
        ]);
    });

    test('updates, rotates and deletes apps', async () => {
        state.clientStore = { c1: true };
        const uris = ['https://notes.example.com/callback'];
        const updated = await post({
            action: 'update',
            clientId: 'c1',
            name: 'New',
            redirectUris: uris
        });
        expect(await updated.json()).toMatchObject({ client: { name: 'New' } });
        expect(
            (await post({ action: 'update', clientId: 'zz', name: 'New', redirectUris: uris }))
                .status
        ).toBe(404);
        expect(
            ((await (await post({ action: 'rotate', clientId: 'c1' })).json()) as any).clientSecret
        ).toBeTruthy();
        expect((await post({ action: 'rotate', clientId: 'zz' })).status).toBe(404);
        expect((await post({ action: 'delete', clientId: 'c1' })).status).toBe(200);
        state.clientStore = {};
        expect((await post({ action: 'delete', clientId: 'c1' })).status).toBe(404);
        expect((await post({ action: 'delete' })).status).toBe(404);
    });

    test('rejects invalid input and storage failures', async () => {
        expect(await code(await post(null, '{nope'))).toBe('OIDC_CLIENT_INVALID_INPUT');
        expect(await code(await post({ action: 'nope' }))).toBe('OIDC_CLIENT_INVALID_INPUT');
        expect((await post({ action: 'create', name: '', redirectUris: [] })).status).toBe(400);
        expect(
            (await post({ action: 'update', clientId: 'c1', name: '', redirectUris: [] })).status
        ).toBe(400);
        state.oidc = {
            ok: true,
            service: {
                oidcClients: {
                    ...makeClients(),
                    delete: async () => {
                        throw new Error('db');
                    }
                }
            }
        };
        expect((await quiet(() => post({ action: 'delete', clientId: 'c1' }))).status).toBe(503);
    });
});
