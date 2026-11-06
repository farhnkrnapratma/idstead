// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot, slots } from './support.ts';

const GRANT = 'a'.repeat(32);
const COMMENT = '0f8fad5b-d9cb-469f-a165-70867728950e';

const state = {
    oidc: { ok: true } as Record<string, any>,
    grants: [{ id: GRANT }] as unknown[],
    grantsError: false,
    revoke: true as boolean,
    revokeError: false,
    auth: { actor: 'admin@example.com' } as Record<string, unknown>,
    dataService: undefined as any,
    stored: undefined as unknown,
    readError: false,
    writeError: false,
    written: [] as unknown[],
    profileError: false,
    result: { status: 'saved' } as Record<string, unknown>,
    saved: [] as unknown[],
    dismissError: false,
    dismissed: [] as string[]
};

slot.oidcAdmin = async () => state.oidc;
slot.verifyAdminRequest = async () => state.auth;
slots.dataStores = () => ({ service: state.dataService });

const grants =
    await import('../../apps/admin/src/routes/api/internal/admin/oidc/grants/+server.ts');
const settings = await import('../../apps/admin/src/routes/api/internal/admin/settings/+server.ts');
const links = await import('../../apps/admin/src/routes/api/internal/admin/links/+server.ts');
const skills = await import('../../apps/admin/src/routes/api/internal/admin/skills/+server.ts');
const resume = await import('../../apps/admin/src/routes/api/internal/admin/resume/+server.ts');
const dismiss =
    await import('../../apps/admin/src/routes/api/internal/admin/comments/dismiss-reports/+server.ts');

function event(init: { method?: string; body?: unknown; raw?: string; origin?: string } = {}) {
    const url = new URL('https://admin.example.com/api/internal/admin/x');
    const method = init.method ?? 'POST';
    const headers: Record<string, string> = {};
    if (init.origin !== '') headers.origin = init.origin ?? url.origin;
    return {
        request: new Request(url, {
            method,
            headers,
            body: method === 'GET' ? undefined : (init.raw ?? JSON.stringify(init.body ?? {}))
        }),
        url,
        platform: {},
        getClientAddress: () => '203.0.113.5'
    } as any;
}

async function code(response: Response) {
    return ((await response.json()) as any).code;
}

beforeEach(() => {
    admin.response = null;
    admin.authFailure = null;
    admin.logged = [];
    state.grantsError = false;
    state.revoke = true;
    state.revokeError = false;
    state.auth = { actor: 'admin@example.com' };
    state.stored = undefined;
    state.readError = false;
    state.writeError = false;
    state.written = [];
    state.profileError = false;
    state.result = { status: 'saved' };
    state.saved = [];
    state.dismissError = false;
    state.dismissed = [];
    const service = {
        oidcAuth: {
            listGrants: async () => {
                if (state.grantsError) throw new Error('db');
                return state.grants;
            },
            revokeGrant: async () => {
                if (state.revokeError) throw new Error('db');
                return state.revoke;
            }
        },
        adminSettings: {
            read: async () => {
                if (state.readError) throw new Error('db');
                return state.stored;
            },
            write: async (_actor: string, value: unknown) => {
                if (state.writeError) throw new Error('db');
                state.written.push(value);
            }
        },
        adminAuthor: {
            ensureProfileId: async () => {
                if (state.profileError) throw new Error('db');
                return 'author-1';
            }
        },
        authorWriter: {
            saveLinks: async (...args: unknown[]) => (state.saved.push(args), state.result),
            saveSkills: async (...args: unknown[]) => (state.saved.push(args), state.result),
            saveResume: async (...args: unknown[]) => (state.saved.push(args), state.result)
        },
        adminActivity: {
            dismissReports: async (id: string) => {
                if (state.dismissError) throw new Error('db');
                state.dismissed.push(id);
            }
        }
    };
    state.dataService = service;
    admin.service = service;
    state.oidc = { ok: true, service };
});

describe('/api/internal/admin/oidc/grants', () => {
    const { GET, POST } = grants as any;

    test('returns the oidc admin failure response', async () => {
        state.oidc = { ok: false, response: Response.json({ code: 'NO' }, { status: 401 }) };
        expect((await GET(event({ method: 'GET' }))).status).toBe(401);
        expect((await POST(event({ body: {} }))).status).toBe(401);
    });

    test('lists grants and fails closed', async () => {
        expect(await (await GET(event({ method: 'GET' }))).json()).toEqual({
            grants: state.grants
        });
        state.grantsError = true;
        const failed = await GET(event({ method: 'GET' }));
        expect(failed.status).toBe(503);
        expect(await code(failed)).toBe('OIDC_UNAVAILABLE');
    });

    test('rejects invalid revocations', async () => {
        for (const body of [
            { action: 'grant', id: GRANT },
            { action: 'revoke', id: 5 },
            { action: 'revoke', id: 'short' }
        ])
            expect(await code(await POST(event({ body })))).toBe('OIDC_GRANT_INVALID_INPUT');
        expect(await code(await POST(event({ raw: '{' })))).toBe('OIDC_GRANT_INVALID_INPUT');
    });

    test('revokes a grant and logs it', async () => {
        const response = await POST(event({ body: { action: 'revoke', id: GRANT } }));
        expect(await response.json()).toEqual({ success: true });
        expect(admin.logged[0]).toMatchObject({ action: 'oidc.grant.revoke', entityId: GRANT });
    });

    test('reports a missing grant and database failures', async () => {
        state.revoke = false;
        const missing = await POST(event({ body: { action: 'revoke', id: GRANT } }));
        expect(missing.status).toBe(404);
        expect(await code(missing)).toBe('OIDC_GRANT_NOT_FOUND');
        state.revokeError = true;
        expect((await POST(event({ body: { action: 'revoke', id: GRANT } }))).status).toBe(503);
    });
});

describe('/api/internal/admin/settings', () => {
    const { GET, PUT } = settings as any;

    test('rejects cross-origin, unavailable and unauthenticated requests', async () => {
        const cross = await GET(event({ method: 'GET', origin: 'https://evil.test' }));
        expect(cross.status).toBe(403);
        state.dataService = undefined;
        const unavailable = await GET(event({ method: 'GET' }));
        expect(await code(unavailable)).toBe('ADMIN_SETTINGS_UNAVAILABLE');
        state.dataService = admin.service;
        state.auth = { status: 401, code: 'NO', message: 'No.' };
        expect((await GET(event({ method: 'GET' }))).status).toBe(401);
        state.auth = { status: 401, message: 'No.' };
        expect(await code(await GET(event({ method: 'GET' })))).toBe('ADMIN_AUTH_REQUIRED');
    });

    test('reads the stored settings', async () => {
        const response = await GET(event({ method: 'GET' }));
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        state.readError = true;
        const failed = await GET(event({ method: 'GET' }));
        expect(await code(failed)).toBe('ADMIN_SETTINGS_READ_FAILED');
    });

    test('saves normalized settings', async () => {
        const response = await PUT(event({ method: 'PUT', body: {} }));
        expect(response.status).toBe(200);
        expect(state.written).toHaveLength(1);
        state.writeError = true;
        const failed = await PUT(event({ method: 'PUT', body: {} }));
        expect(await code(failed)).toBe('ADMIN_SETTINGS_WRITE_FAILED');
    });

    test('rejects oversized and malformed payloads', async () => {
        const large = await PUT(event({ method: 'PUT', raw: ' '.repeat(2049) }));
        expect(large.status).toBe(413);
        const malformed = await PUT(event({ method: 'PUT', raw: '{' }));
        expect(await code(malformed)).toBe('ADMIN_SETTINGS_INVALID');
        state.auth = { status: 401, message: 'No.' };
        expect((await PUT(event({ method: 'PUT', body: {} }))).status).toBe(401);
    });
});

const writers = [
    {
        name: 'links',
        route: links,
        valid: { category: 'social', items: [{ a: 1 }] },
        invalid: [{ category: 'zzz', items: [] }, { category: 'social', items: 'x' }, null],
        invalidCode: 'LINKS_INVALID_INPUT',
        unavailable: 'LINKS_STORAGE_UNAVAILABLE',
        failed: 'LINKS_SAVE_FAILED',
        action: 'links.update'
    },
    {
        name: 'skills',
        route: skills,
        valid: { categories: [{ a: 1 }] },
        invalid: [{ categories: 'x' }, {}, null],
        invalidCode: 'SKILLS_INVALID_INPUT',
        unavailable: 'SKILLS_STORAGE_UNAVAILABLE',
        failed: 'SKILLS_SAVE_FAILED',
        action: 'skills.update'
    },
    {
        name: 'resume',
        route: resume,
        valid: { experiences: [{ a: 1 }], education: [] },
        invalid: [{ experiences: [], education: 'x' }, { experiences: 'x', education: [] }, null],
        invalidCode: 'RESUME_INVALID_INPUT',
        unavailable: 'RESUME_STORAGE_UNAVAILABLE',
        failed: 'RESUME_SAVE_FAILED',
        action: 'resume.entries_update'
    }
];

for (const entry of writers) {
    describe(`POST /api/internal/admin/${entry.name}`, () => {
        const { POST } = entry.route as any;

        test('returns the admin failure response', async () => {
            admin.response = Response.json({ code: 'NO' }, { status: 401 });
            expect((await POST(event({ body: entry.valid }))).status).toBe(401);
        });

        test('rejects invalid bodies', async () => {
            for (const body of entry.invalid) {
                const response = await POST(event({ raw: JSON.stringify(body) }));
                expect(response.status).toBe(400);
                expect(await code(response)).toBe(entry.invalidCode);
            }
            expect(await code(await POST(event({ raw: '{' })))).toBe(entry.invalidCode);
            expect(state.saved).toEqual([]);
        });

        test('fails closed when the profile lookup throws', async () => {
            state.profileError = true;
            const response = await POST(event({ body: entry.valid }));
            expect(response.status).toBe(503);
            expect(await code(response)).toBe(entry.unavailable);
        });

        test('reports a rejected save', async () => {
            state.result = { status: 'rejected', message: 'Nope.' };
            const response = await POST(event({ body: entry.valid }));
            expect(await code(response)).toBe(entry.failed);
            expect(admin.logged).toEqual([]);
        });

        test('saves and logs the change', async () => {
            const response = await POST(event({ body: entry.valid }));
            expect(await response.json()).toEqual({ success: true });
            expect((state.saved[0] as unknown[])[0]).toBe('author-1');
            expect(admin.logged[0]).toMatchObject({ action: entry.action });
        });
    });
}

describe('POST /api/internal/admin/comments/dismiss-reports', () => {
    const { POST } = dismiss as any;

    test('returns the admin failure response', async () => {
        admin.authFailure = Response.json({ code: 'NO' }, { status: 401 });
        expect((await POST(event({ body: { commentId: COMMENT } }))).status).toBe(401);
    });

    test('rejects invalid ids and malformed JSON', async () => {
        expect(await code(await POST(event({ raw: '{' })))).toBe('INVALID_JSON_BODY');
        expect(await code(await POST(event({ body: {} })))).toBe('COMMENT_ID_REQUIRED');
        expect(await code(await POST(event({ body: { commentId: 5 } })))).toBe(
            'COMMENT_ID_REQUIRED'
        );
        expect(await code(await POST(event({ body: { commentId: 'nope' } })))).toBe(
            'COMMENT_ID_INVALID'
        );
        expect(await code(await POST(event({ raw: 'null' })))).toBe('COMMENT_ID_REQUIRED');
    });

    test('reports unavailable and failing storage', async () => {
        state.dataService = undefined;
        const unavailable = await POST(event({ body: { commentId: COMMENT } }));
        expect(await code(unavailable)).toBe('DATABASE_UNAVAILABLE');
        state.dataService = admin.service;
        state.dismissError = true;
        const failed = await POST(event({ body: { commentId: COMMENT } }));
        expect(await code(failed)).toBe('DISMISS_REPORTS_FAILED');
    });

    test('dismisses the reports and logs it', async () => {
        const response = await POST(event({ body: { commentId: ` ${COMMENT} ` } }));
        expect(await response.json()).toEqual({ success: true });
        expect(state.dismissed).toEqual([COMMENT]);
        expect(admin.logged[0]).toMatchObject({ action: 'blog.reports_dismiss' });
    });
});
