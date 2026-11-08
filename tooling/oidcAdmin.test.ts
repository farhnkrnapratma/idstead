// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = { auth: {} as Record<string, unknown>, service: undefined as unknown };

mock.module('../packages/lib/src/server/blogPostAuth.ts', () => ({
    blogAdmin: async () => state.auth
}));
mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: state.service })
}));

const { oidcAdmin } = await import('../packages/lib/src/server/oidc/admin.ts');

const url = new URL('https://admin.example.com/api/internal/admin/oidc/clients');
const request = new Request(url);

beforeEach(() => {
    state.auth = { status: 401, code: undefined, message: 'Sign in again.' };
    state.service = { oidcClients: {} };
});

describe('oidcAdmin', () => {
    test('maps a refused admin check to its status, code and message', async () => {
        const unauthenticated = await oidcAdmin(request, url, {});
        expect(unauthenticated.ok).toBe(false);
        if (unauthenticated.ok) throw new Error('expected a refusal');
        expect(unauthenticated.response.status).toBe(401);
        expect(await unauthenticated.response.json()).toMatchObject({
            code: 'ADMIN_AUTH_REQUIRED',
            message: 'Sign in again.'
        });

        state.auth = { status: 403, message: 'Not an admin.' };
        const forbidden = await oidcAdmin(request, url, {});
        if (forbidden.ok) throw new Error('expected a refusal');
        expect(await forbidden.response.json()).toMatchObject({ code: 'ADMIN_FORBIDDEN' });

        state.auth = { status: 409, code: 'CUSTOM', message: 'Conflict.' };
        const custom = await oidcAdmin(request, url, {});
        if (custom.ok) throw new Error('expected a refusal');
        expect(custom.response.status).toBe(409);
        expect(await custom.response.json()).toMatchObject({ code: 'CUSTOM' });
    });

    test('reports an unavailable database as a service error', async () => {
        state.auth = { actor: 'ada@example.com', authTime: 100 };
        state.service = undefined;
        const result = await oidcAdmin(request, url, {});
        if (result.ok) throw new Error('expected a refusal');
        expect(result.response.status).toBe(503);
        expect(await result.response.json()).toMatchObject({ code: 'OIDC_UNAVAILABLE' });
    });

    test('returns the actor, its sign-in time and the store when allowed', async () => {
        state.auth = { actor: 'ada@example.com', authTime: 100 };
        const result = await oidcAdmin(request, url, {});
        expect(result).toEqual({
            ok: true,
            actor: 'ada@example.com',
            authTime: 100,
            service: state.service
        });
    });
});
