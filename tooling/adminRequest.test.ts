// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = { available: true };

mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: storage.available ? { activityLog: undefined } : undefined })
}));

const auth = { status: 0, message: '', actor: 'ada@example.com' } as {
    status: number;
    message: string;
    code?: string;
    actor?: string | null;
};

mock.module('../packages/lib/src/server/adminAuth.ts', () => ({
    verifyAdminRequest: async () => auth,
    adminActor: async () => auth.actor ?? null
}));

const { requireAdminAuth, requireSameOriginAdmin, adminServices, logAdminActivity } =
    await import('../packages/lib/src/server/adminRequest.ts');

const origin = 'https://admin.example.com';
const url = new URL(`${origin}/api/internal/admin/posts`);

function request(headers: Record<string, string> = {}) {
    return new Request(url, { headers });
}

beforeEach(() => {
    storage.available = true;
    auth.status = 0;
    auth.message = '';
    auth.code = undefined;
    auth.actor = 'ada@example.com';
});

describe('requireAdminAuth', () => {
    test('passes authorized requests through', async () => {
        expect(await requireAdminAuth(request())).toBeNull();
    });

    test('maps unauthenticated and forbidden callers to API errors', async () => {
        auth.status = 401;
        auth.message = 'Sign in first.';
        const unauthenticated = await requireAdminAuth(request());
        expect(unauthenticated?.status).toBe(401);
        expect(await unauthenticated?.json()).toMatchObject({
            code: 'ADMIN_AUTH_REQUIRED',
            message: 'Sign in first.'
        });

        auth.status = 403;
        auth.message = 'Not an admin.';
        const forbidden = await requireAdminAuth(request());
        expect(forbidden?.status).toBe(403);
        expect(await forbidden?.json()).toMatchObject({ code: 'ADMIN_FORBIDDEN' });
    });
});

describe('requireSameOriginAdmin', () => {
    test('rejects cross-origin requests before checking the admin', async () => {
        const response = await requireSameOriginAdmin(
            request({ origin: 'https://evil.example' }),
            url
        );
        expect(response?.status).toBe(403);
        expect(await response?.json()).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
    });

    test('checks the admin for same-origin requests', async () => {
        expect(
            await requireSameOriginAdmin(request({ origin, 'sec-fetch-site': 'same-origin' }), url)
        ).toBeNull();
        auth.status = 401;
        const response = await requireSameOriginAdmin(
            request({ origin, 'sec-fetch-site': 'same-origin' }),
            url
        );
        expect(response?.status).toBe(401);
    });
});

describe('adminServices', () => {
    test('returns the admin response when the caller is denied', async () => {
        auth.status = 401;
        const result = await adminServices(request(), url, {}, { code: 'UNAVAILABLE' });
        expect(result.response?.status).toBe(401);
        expect(result.service).toBeUndefined();
    });

    test('returns the storage services for an authorized admin', async () => {
        const result = await adminServices(
            request({ origin, 'sec-fetch-site': 'same-origin' }),
            url,
            {},
            { code: 'STORE_DOWN' }
        );
        expect(result.response).toBeUndefined();
        expect(result.service).toEqual({ activityLog: undefined });
    });

    test('reports unavailable storage with the given code and message', async () => {
        storage.available = false;
        const result = await adminServices(
            request({ origin, 'sec-fetch-site': 'same-origin' }),
            url,
            {},
            { code: 'STORE_DOWN', message: 'Store is down.' }
        );
        expect(result.response?.status).toBe(503);
        expect(await result.response?.json()).toMatchObject({
            code: 'STORE_DOWN',
            message: 'Store is down.'
        });
    });

    test('uses the default unavailable message', async () => {
        storage.available = false;
        const result = await adminServices(
            request({ origin, 'sec-fetch-site': 'same-origin' }),
            url,
            {},
            { code: 'STORE_DOWN' }
        );
        expect(await result.response?.json()).toMatchObject({
            message: 'Database is unavailable.'
        });
    });
});

describe('logAdminActivity', () => {
    test('resolves without an activity log and tolerates a failing address getter', async () => {
        const original = console.error;
        console.error = () => {};
        try {
            await expect(
                logAdminActivity(
                    request({ 'user-agent': 'UA' }),
                    { env: { IP_SALT: 'salt' } },
                    { action: 'post.save', category: 'blog', summary: 'saved' },
                    () => {
                        throw new Error('no address');
                    }
                )
            ).resolves.toBeUndefined();
        } finally {
            console.error = original;
        }
    });
});
