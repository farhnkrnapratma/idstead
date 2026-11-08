// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './support.ts';

const state = {
    auth: { actor: 'admin@example.com' } as Record<string, unknown>,
    service: undefined as any,
    readError: false,
    saveError: false,
    saved: [] as unknown[]
};

slot.verifyAdminRequest = async () => state.auth;
slots.dataStores = () => ({ service: state.service });

const cases = [
    {
        name: 'content-license',
        key: 'contentLicense',
        reader: 'contentLicense',
        saver: 'saveContentLicense',
        valid: { license: 'CC0-1.0' },
        invalid: { license: 'nope' },
        limit: 512,
        action: 'settings.contentLicense',
        entityId: 'CC0-1.0',
        route: await import('../../apps/admin/src/routes/api/internal/admin/site-settings/content-license/+server.ts')
    },
    {
        name: 'analytics',
        key: 'analytics',
        reader: 'analytics',
        saver: 'saveAnalytics',
        valid: { provider: 'ga4', measurementId: 'G-ABC123XYZ' },
        invalid: { provider: 'ga4', measurementId: 'bad' },
        limit: 2048,
        action: 'settings.analytics',
        entityId: 'ga4',
        route: await import('../../apps/admin/src/routes/api/internal/admin/site-settings/analytics/+server.ts')
    }
];

function event(body?: string) {
    const url = new URL('https://admin.example.com/api/internal/admin/site-settings');
    const request = new Request(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'sec-fetch-site': 'same-origin' },
        body
    });
    return { request, url, platform: {}, getClientAddress: () => '203.0.113.7' } as any;
}

beforeEach(() => {
    delete slot.blogAdmin;
    state.auth = { actor: 'admin@example.com' };
    state.readError = false;
    state.saveError = false;
    state.saved = [];
    admin.logged = [];
});

for (const entry of cases) {
    describe(`/api/internal/admin/site-settings/${entry.name}`, () => {
        const { GET, POST } = entry.route as any;

        beforeEach(() => {
            state.service = {
                site: {
                    [entry.reader]: async () => {
                        if (state.readError) throw new Error('db');
                        return entry.valid;
                    }
                },
                siteSettingsWriter: {
                    [entry.saver]: async (settings: unknown) => {
                        if (state.saveError) throw new Error('db');
                        state.saved.push(settings);
                    }
                }
            };
        });

        test('rejects cross-origin and unauthenticated requests', async () => {
            const url = new URL('https://admin.example.com/x');
            const request = new Request(url, { headers: { origin: 'https://evil.test' } });
            const response = await GET({ request, url, platform: {} });
            expect(response.status).toBe(403);
            state.auth = { status: 401, code: 'NO', message: 'No.' };
            expect((await GET(event())).status).toBe(401);
            state.auth = { status: 401, message: 'No.' };
            expect(((await (await GET(event())).json()) as any).code).toBe('ADMIN_AUTH_REQUIRED');
        });

        test('reports unavailable settings', async () => {
            state.service = undefined;
            const response = await GET(event());
            expect(response.status).toBe(503);
            expect(((await response.json()) as any).code).toBe('SITE_SETTINGS_UNAVAILABLE');
        });

        test('reads the current setting', async () => {
            const response = await GET(event());
            expect(response.headers.get('cache-control')).toBe('no-store');
            expect(await response.json()).toEqual({ [entry.key]: entry.valid });
        });

        test('fails closed when the read throws', async () => {
            state.readError = true;
            expect((await GET(event())).status).toBe(503);
        });

        test('saves a valid setting and logs it', async () => {
            const response = await POST(event(JSON.stringify(entry.valid)));
            expect(response.status).toBe(200);
            expect(state.saved).toHaveLength(1);
            expect(admin.logged[0]).toMatchObject({
                action: entry.action,
                category: 'settings',
                entityId: entry.entityId
            });
            expect(((await response.json()) as any)[entry.key]).toMatchObject(entry.valid);
        });

        test('rejects authorization failures and oversized bodies', async () => {
            state.auth = { status: 401, code: 'NO', message: 'No.' };
            expect((await POST(event('{}'))).status).toBe(401);
            state.auth = { actor: 'a' };
            const response = await POST(event(' '.repeat(entry.limit + 1)));
            expect(response.status).toBe(413);
        });

        test('rejects invalid settings and malformed JSON', async () => {
            const invalid = await POST(event(JSON.stringify(entry.invalid)));
            expect(invalid.status).toBe(400);
            expect(((await invalid.json()) as any).code).toBe('SITE_SETTINGS_INVALID');
            const malformed = await POST(event('{'));
            expect(((await malformed.json()) as any).message).toBe('Settings must be valid JSON.');
            expect(state.saved).toEqual([]);
        });

        test('fails closed when the save throws', async () => {
            state.saveError = true;
            expect((await POST(event(JSON.stringify(entry.valid)))).status).toBe(503);
            expect(admin.logged).toEqual([]);
        });
    });
}
