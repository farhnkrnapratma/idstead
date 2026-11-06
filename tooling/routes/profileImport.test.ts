// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { admin } from './support.ts';

class ProfileInputError extends Error {
    fields: Record<string, string>;
    constructor(fields: Record<string, string>) {
        super('invalid');
        this.fields = fields;
    }
}

const state = {
    profileRecord: { id: 'author-1', profile_revision: 4 } as any,
    profileRecordError: false,
    patchError: undefined as unknown,
    patches: [] as Array<Record<string, unknown>>,
    saveProfile: { status: 'saved' } as Record<string, unknown>,
    resumeEntries: { experience: [{ title: 'old' }], education: [{ degree: 'old' }] },
    saveResume: { status: 'saved' } as Record<string, unknown>,
    saveResumeError: undefined as unknown,
    saveSkills: { status: 'saved' } as Record<string, unknown>,
    saveLinks: { status: 'saved' } as Record<string, unknown>,
    calls: [] as Array<[string, ...unknown[]]>
};

admin.service = {
    adminAuthor: {
        profileRecord: async () => {
            if (state.profileRecordError) throw new Error('down');
            return state.profileRecord;
        },
        saveProfile: async (payload: unknown) => {
            state.calls.push(['saveProfile', payload]);
            return state.saveProfile;
        },
        resumeEntries: async () => state.resumeEntries
    },
    authorWriter: {
        saveResume: async (...args: unknown[]) => {
            state.calls.push(['saveResume', ...args]);
            if (state.saveResumeError !== undefined) throw state.saveResumeError;
            return state.saveResume;
        },
        saveSkills: async (...args: unknown[]) => {
            state.calls.push(['saveSkills', ...args]);
            return state.saveSkills;
        },
        saveLinks: async (...args: unknown[]) => {
            state.calls.push(['saveLinks', ...args]);
            return state.saveLinks;
        }
    }
};

mock.module('../../packages/lib/src/server/profilePatch.ts', () => ({
    ProfileInputError,
    profilePatch: (patch: Record<string, unknown>) => {
        state.patches.push(patch);
        if (state.patchError !== undefined) throw state.patchError;
        return patch;
    }
}));

const { POST } =
    (await import('../../apps/admin/src/routes/api/internal/admin/profile/import/+server.ts')) as {
        POST: (event: any) => Promise<Response>;
    };

async function send(body: unknown, raw = false) {
    const response = await POST({
        request: new Request('https://admin.example.com/api/internal/admin/profile/import', {
            method: 'POST',
            body: raw ? (body as string) : JSON.stringify(body)
        }),
        url: new URL('https://admin.example.com/api/internal/admin/profile/import'),
        platform: {},
        getClientAddress: () => '203.0.113.1'
    });
    return { response, body: (await response.json()) as Record<string, any> };
}

beforeEach(() => {
    admin.response = null;
    state.profileRecord = { id: 'author-1', profile_revision: 4 };
    state.profileRecordError = false;
    state.patchError = undefined;
    state.patches = [];
    state.saveProfile = { status: 'saved' };
    state.saveResume = { status: 'saved' };
    state.saveResumeError = undefined;
    state.saveSkills = { status: 'saved' };
    state.saveLinks = { status: 'saved' };
    state.calls = [];
    admin.logged = [];
});

describe('POST /api/internal/admin/profile/import', () => {
    test('returns the admin failure response', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await send({})).response.status).toBe(401);
    });

    test('rejects unreadable and non-object payloads', async () => {
        expect((await send('{nope', true)).response.status).toBe(400);
        expect((await send('null', true)).body.code).toBe('PROFILE_IMPORT_INVALID_INPUT');
        expect((await send([1])).body.message).toBe('Invalid import payload.');
        expect((await send('"text"', true)).response.status).toBe(400);
    });

    test('requires a stored profile', async () => {
        state.profileRecordError = true;
        expect((await send({ profile: {} })).response.status).toBe(503);
        state.profileRecordError = false;
        state.profileRecord = null;
        expect((await send({ profile: {} })).response.status).toBe(404);
        state.profileRecord = {};
        expect((await send({ profile: {} })).body.code).toBe('PROFILE_NOT_FOUND');
    });

    test('rejects files without known sections', async () => {
        const { response, body } = await send({ other: 1, profile: 'text', resume: 3 });
        expect(response.status).toBe(400);
        expect(body.code).toBe('PROFILE_IMPORT_EMPTY');
    });

    test('imports every section and logs the activity', async () => {
        const { response, body } = await send({
            profile: {
                name: ' Ada ',
                pronunciation: 'AY-duh',
                username: 'ada',
                email: 'ada@example.com',
                headline: 'Engineer',
                jobTitle: 'Dev',
                bio: 'Bio',
                city: 'London',
                postalCode: '1',
                country: 'UK',
                siteUrl: 'https://ada.example'
            },
            resume: {
                experience: [
                    { title: 'Dev', currentlyIn: true, startYear: '2020', endYear: 2022 },
                    { title: 'Lead', endMonth: 'May', endYear: '2024', locType: 'remote' },
                    null
                ],
                education: [{ institution: 'Uni', currentlyIn: false }, {}]
            },
            skills: [{ category: 'Langs', items: ['TS', '', 5] }, { category: 'None' }, null],
            socials: [{ platform: 'GitHub', url: 'https://github.com/ada', displayValue: 'ada' }],
            funding: [{ platform: 'Sponsors', url: 'https://x.test' }],
            contact: [{ platform: 'Mail', href: 'mailto:a@b.co', icon: 'mail', description: 'd' }]
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(body).toEqual({
            success: true,
            applied: ['profile', 'resume', 'skills', 'socials', 'funding', 'contact'],
            errors: {}
        });
        expect(state.patches[0]).toMatchObject({ id: 'author-1', revision: 4, name: 'Ada' });
        const resume = state.calls.find(call => call[0] === 'saveResume')!;
        expect((resume[2] as any[])[0]).toMatchObject({
            currently_in: true,
            end_month: null,
            end_year: null,
            sort_order: 1
        });
        expect((resume[2] as any[])[1]).toMatchObject({ end_month: 'May', end_year: 2024 });
        expect(state.calls.find(call => call[0] === 'saveLinks')![2]).toBe('social');
        expect(admin.logged[0].summary).toBe(
            'Imported profile, resume, skills, socials, funding, contact.'
        );
    });

    test('fills the missing half of a resume from storage', async () => {
        await send({ resume: { experience: [] } });
        await send({ resume: { education: [] } });
        const saved = state.calls.filter(call => call[0] === 'saveResume');
        expect((saved[0][3] as any[])[0].degree).toBe('old');
        expect((saved[1][2] as any[])[0].title).toBe('old');
        const none = await send({ resume: {}, skills: [] });
        expect(none.body.applied).toEqual(['skills']);
    });

    test('records section failures without stopping the import', async () => {
        state.patchError = new ProfileInputError({ name: 'Name is required.' });
        state.saveResume = { status: 'rejected', message: 'resume refused' };
        state.saveSkills = { status: 'rejected', message: 'skills refused' };
        state.saveLinks = { status: 'rejected', message: 'links refused' };
        const first = await send({
            profile: { name: '' },
            resume: { experience: [], education: [] },
            skills: [],
            socials: [],
            funding: [],
            contact: []
        });
        expect(first.body.applied).toEqual([]);
        expect(first.body.errors).toEqual({
            profile: 'Name is required.',
            resume: 'resume refused',
            skills: 'skills refused',
            socials: 'links refused',
            funding: 'links refused',
            contact: 'links refused'
        });
        expect(admin.logged[0].summary.startsWith('Imported nothing; failed: profile')).toBe(true);

        state.patchError = new Error('plain');
        state.saveResumeError = 'not an error';
        const second = await send({ profile: {}, resume: { experience: [], education: [] } });
        expect(second.body.errors).toEqual({ profile: 'plain', resume: 'Invalid resume data.' });
        state.patchError = 'odd';
        expect((await send({ profile: {} })).body.errors.profile).toBe('Invalid profile data.');
        state.patchError = undefined;
        state.saveProfile = { status: 'failed', message: 'save failed' };
        expect((await send({ profile: {} })).body.errors.profile).toBe('save failed');
    });
});
