// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { assetNames } from '../packages/lib/src/server/profileAssets.ts';
import { avatarAssetNames, bannerAssetNames } from '../packages/lib/src/siteIdentity.ts';
import { avatarForm, bannerEntries } from './imageFixtures.ts';

const state = {
    authFailure: null as Response | null,
    verify: { status: 0, actor: 'actor' } as Record<string, unknown>,
    service: undefined as unknown,
    limiter: undefined as unknown,
    logged: [] as Array<Record<string, any>>
};

mock.module('../packages/lib/src/server/adminRequest.ts', () => ({
    requireAdminAuth: async () => state.authFailure,
    logAdminActivity: async (_r: Request, _p: unknown, entry: Record<string, any>) =>
        void state.logged.push(entry)
}));
mock.module('../packages/lib/src/server/adminAuth.ts', () => ({
    verifyAdminRequest: async () => state.verify
}));
mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: state.service })
}));
mock.module('../packages/lib/src/server/workerEnv.ts', () => ({
    workerBinding: async () => state.limiter
}));

const route = await import('../apps/admin/src/routes/api/internal/admin/profile/+server.ts');

const PROFILE_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AVATAR_VERSION = '1f8fad5b-d9cb-469f-a165-70867728950e';
const BANNER_VERSION = '2f8fad5b-d9cb-469f-a165-70867728950e';

function memoryBucket() {
    const store = new Map<string, Uint8Array>();
    const bucket = {
        store,
        failPut: false,
        async get(key: string) {
            const bytes = store.get(key);
            return bytes ? { key, httpMetadata: {}, arrayBuffer: async () => bytes.buffer } : null;
        },
        async put(key: string, value: ArrayBuffer) {
            if (bucket.failPut) throw new Error('put failed');
            store.set(key, new Uint8Array(value));
            return null;
        },
        async delete(keys: string | string[]) {
            for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
        }
    };
    return bucket;
}

let bucket = memoryBucket();
let platform: Record<string, unknown>;
let counter = 0;

interface Store {
    [key: string]: (...args: any[]) => Promise<any>;
}
let store: Store;
let saved: Array<[Record<string, any>, any]>;
let registered: Array<Record<string, any>>;
let deleted: string[];

const current = {
    id: PROFILE_ID,
    profile_revision: 3,
    avatar_version: AVATAR_VERSION,
    banner_version: BANNER_VERSION,
    manifest_settings: { display: 'standalone' }
};
const asset = (name: string) => ({ name, key: `identity/${BANNER_VERSION}/${name}` });
const versionRows = (kind: 'identity' | 'avatar' = 'identity') => [
    {
        id: AVATAR_VERSION,
        kind,
        source: 'custom',
        fingerprint: null,
        avatar_source: 'generated',
        avatar_fingerprint: 'a'.repeat(64),
        banner_source: null,
        banner_fingerprint: null,
        assets: avatarAssetNames.map(asset)
    },
    {
        id: BANNER_VERSION,
        kind: 'identity',
        source: 'custom',
        fingerprint: null,
        avatar_source: null,
        avatar_fingerprint: null,
        banner_source: 'generated',
        banner_fingerprint: 'b'.repeat(64),
        assets: bannerAssetNames.map(asset)
    }
];

function reset() {
    saved = [];
    registered = [];
    deleted = [];
    store = {
        identityDefaults: async () => ({ display: 'standalone' }),
        profileRecord: async () => ({ ...current }),
        identityVersions: async () => versionRows(),
        registerIdentityVersion: async (row: Record<string, any>) => void registered.push(row),
        deleteIdentityVersion: async (version: string) => void deleted.push(version),
        saveProfile: async (payload: Record<string, any>, identity: unknown) => {
            saved.push([payload, identity]);
            return { status: 'saved', profile: { id: PROFILE_ID } };
        },
        profileWithAvatarVersion: async () => ({ id: PROFILE_ID }),
        claimIdentityCleanup: async () => []
    };
    state.service = { adminAuthor: store };
}

beforeEach(() => {
    bucket = memoryBucket();
    platform = { env: { ASSET_BUCKET: bucket } };
    for (const name of assetNames) bucket.store.set(`identity/${name}`, new Uint8Array([1]));
    state.authFailure = null;
    state.verify = { status: 0, actor: `actor-${counter++}` };
    state.limiter = undefined;
    state.logged = [];
    reset();
});

const profileFields = {
    name: 'Ada Lovelace',
    username: 'ada',
    headline: 'Engineer',
    job_title: 'Analyst',
    bio: 'Bio',
    email: 'ada@example.com',
    city: 'London',
    postal_code: 'N1',
    country: 'UK',
    site_url: 'https://ada.test',
    pronunciation: ''
};

function formFor(
    payload: unknown,
    options: { avatar?: boolean; banner?: boolean; extra?: Record<string, string> } = {}
) {
    const form = new FormData();
    if (payload !== undefined)
        form.set('profile', typeof payload === 'string' ? payload : JSON.stringify(payload));
    if (options.avatar) {
        for (const [name, value] of avatarForm().entries()) form.set(name, value);
    }
    if (options.banner)
        for (const [name, file] of Object.entries(bannerEntries())) form.set(name, file);
    for (const [name, value] of Object.entries(options.extra ?? {})) form.set(name, value);
    return form;
}

async function call(
    body: FormData | null,
    options: { origin?: string; method?: string; keepActor?: boolean } = {}
): Promise<Response> {
    if (!options.keepActor && state.verify.status === 0)
        state.verify = { status: 0, actor: `actor-${counter++}` };
    const url = new URL('https://admin.test/api/internal/admin/profile');
    const request = new Request(url, {
        method: options.method ?? 'POST',
        headers: { origin: options.origin ?? url.origin },
        body: body ?? undefined
    });
    return route.POST({ request, platform, url, getClientAddress: () => '203.0.113.7' } as never);
}

const update = (fields: Record<string, unknown> = {}) => ({
    id: PROFILE_ID,
    revision: 3,
    ...fields
});
const create = (fields: Record<string, unknown> = {}) => ({
    id: null,
    revision: 0,
    ...profileFields,
    ...fields
});
const text = async (response: Response) => JSON.stringify(await response.json());

describe('GET', () => {
    const get = () => route.GET({ request: new Request('https://admin.test/'), platform } as never);

    test('requires authentication and storage', async () => {
        state.authFailure = new Response('denied', { status: 401 });
        expect((await get()).status).toBe(401);
        state.authFailure = null;
        state.service = undefined;
        expect((await get()).status).toBe(503);
    });

    test('returns identity defaults', async () => {
        const response = await get();
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({ manifestSettings: { display: 'standalone' } });
        store.identityDefaults = async () => {
            throw new Error('db');
        };
        expect((await get()).status).toBe(503);
    });
});

describe('POST access control', () => {
    test('rejects cross-origin and unauthenticated requests', async () => {
        expect((await call(formFor(update()), { origin: 'https://evil.test' })).status).toBe(403);
        state.verify = { status: 401, message: 'denied' };
        expect((await call(formFor(update()))).status).toBe(401);
    });

    test('requires storage', async () => {
        state.service = undefined;
        expect((await call(formFor(update()))).status).toBe(503);
    });

    test('rate limits by binding and by recent attempts', async () => {
        state.limiter = { limit: async () => ({ success: false }) };
        expect((await call(formFor(update()))).status).toBe(429);
        state.limiter = { limit: async () => ({ success: true }) };
        state.verify = { status: 0, actor: 'repeat-actor' };
        expect((await call(formFor(update()), { keepActor: true })).status).toBe(200);
        expect((await call(formFor(update()), { keepActor: true })).status).toBe(429);
    });
});

describe('POST request parsing', () => {
    test('rejects missing and oversized bodies', async () => {
        expect((await call(null)).status).toBe(400);
        const big = formFor(update(), { extra: { junk: 'x'.repeat(6_100_000) } });
        expect((await call(big)).status).toBe(413);
    });

    test('rejects invalid profile data', async () => {
        const duplicate = formFor(update());
        duplicate.append('profile', JSON.stringify(update()));
        const cases: Array<FormData> = [
            formFor(undefined),
            duplicate,
            formFor('{'),
            formFor('[]'),
            formFor('null'),
            formFor({ id: PROFILE_ID }),
            formFor({ id: PROFILE_ID, revision: -1 }),
            formFor({ id: PROFILE_ID, revision: 1.5 }),
            formFor({ id: 5, revision: 1 }),
            formFor({ id: 'not-a-uuid', revision: 1 }),
            formFor(JSON.stringify({ id: PROFILE_ID, revision: 3, pad: 'x'.repeat(20_000) }))
        ];
        for (const form of cases) expect((await call(form)).status).toBe(400);
    });

    test('checks the stored profile revision', async () => {
        store.profileRecord = async () => {
            throw new Error('db');
        };
        expect((await call(formFor(update()))).status).toBe(503);
        store.profileRecord = async () => null;
        expect((await call(formFor(update()))).status).toBe(409);
        store.profileRecord = async () => ({ ...current, profile_revision: 9 });
        expect((await call(formFor(update()))).status).toBe(409);
    });

    test('reports field errors', async () => {
        const response = await call(formFor(update({ email: 'nope' })));
        expect(response.status).toBe(400);
        expect(await text(response)).toContain('email');
        const missingAvatar = await call(formFor(create(), { banner: true }));
        expect(await text(missingAvatar)).toContain('Profile image is required.');
        const missingBanner = await call(formFor(create(), { avatar: true }));
        expect(await text(missingBanner)).toContain('Website banner is required.');
        const badMeta = await call(formFor(update(), { extra: { identity: '{' } }));
        expect(badMeta.status).toBe(400);
        const incomplete = await call(formFor(update(), { extra: { 'banner.webp': 'x' } }));
        expect(incomplete.status).toBe(400);
    });
});

describe('POST saving without images', () => {
    test('updates text fields', async () => {
        const response = await call(formFor(update({ bio: 'New bio', headline: 'Head' })));
        const body = (await response.json()) as Record<string, any>;
        expect(body).toMatchObject({ success: true, cleanupPending: false });
        expect(saved[0][1]).toBeNull();
        expect(state.logged[0]).toMatchObject({ action: 'profile.update', category: 'profile' });
        expect(state.logged[0].summary).toBe('Updated headline, bio.');
        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    test('summarises an empty change', async () => {
        await call(formFor(update()));
        expect(state.logged[0].summary).toContain('Updated');
    });
});

describe('POST saving with images', () => {
    test('creates a profile with new images', async () => {
        store.profileRecord = async () => null;
        const response = await call(
            formFor(create(), {
                avatar: true,
                banner: true,
                extra: {
                    identity: JSON.stringify({
                        avatar: { source: 'generated', fingerprint: 'c'.repeat(64) },
                        banner: { source: 'custom' }
                    })
                }
            })
        );
        expect(response.status).toBe(200);
        expect(registered[0]).toMatchObject({ kind: 'identity', avatar_source: 'generated' });
        expect(saved[0][1].assets.length).toBe(assetNames.length);
        expect(state.logged[0].action).toBe('profile.avatar_update');
        expect(state.logged[0].summary).toContain('image and banner and');
        expect(bucket.store.has('identity/avatar.png')).toBe(true);
    });

    test('keeps the banner when only the avatar changes', async () => {
        const response = await call(formFor(update({ bio: 'x' }), { avatar: true }));
        expect(response.status).toBe(200);
        const names = saved[0][1].assets.map((entry: { name: string }) => entry.name).sort();
        expect(names).toEqual([...assetNames].sort());
        expect(registered[0].banner_source).toBe('generated');
        expect(state.logged[0].summary).toBe('Updated profile image and bio.');
    });

    test('keeps the avatar when only the banner changes', async () => {
        store.identityVersions = async () =>
            versionRows('avatar').slice(0, 1).concat(versionRows().slice(1));
        for (const name of avatarAssetNames)
            bucket.store.set(`identity/${name}`, new Uint8Array([1]));
        const response = await call(formFor(update(), { banner: true }));
        expect(response.status).toBe(200);
        expect(registered[0].avatar_source).toBe('custom');
        expect(state.logged[0].summary).toBe('Updated profile banner.');
    });

    test('requires a complete image package for kept images', async () => {
        store.identityVersions = async () => [];
        const response = await call(formFor(update(), { avatar: true }));
        expect(response.status).toBe(400);
        expect(await text(response)).toContain('website banner again');
        store.identityVersions = async () => versionRows();
        store.identityVersions = async () => [
            { ...versionRows()[0], assets: [] },
            versionRows()[1]
        ];
        const avatarGap = await call(formFor(update(), { banner: true }));
        expect(await text(avatarGap)).toContain('profile image again');
    });

    test('reports metadata failures', async () => {
        store.identityVersions = async () => {
            throw new Error('db');
        };
        expect((await call(formFor(update(), { avatar: true }))).status).toBe(503);
        reset();
        store.registerIdentityVersion = async () => {
            throw new Error('db');
        };
        expect((await call(formFor(update(), { avatar: true }))).status).toBe(503);
    });

    test('reports storage failures and discards the version', async () => {
        bucket.failPut = true;
        const response = await call(formFor(update(), { avatar: true }));
        expect(response.status).toBe(502);
        expect(deleted).toHaveLength(1);
        store.deleteIdentityVersion = async () => {
            throw new Error('db');
        };
        expect((await call(formFor(update(), { avatar: true }))).status).toBe(502);
    });

    test('reports missing source objects while copying kept assets', async () => {
        bucket.store.clear();
        const response = await call(formFor(update(), { avatar: true }));
        expect(response.status).toBe(502);
    });
});

describe('POST save failures', () => {
    const failing = (code: string | undefined) => async () => ({
        status: 'failed',
        code,
        message: 'boom'
    });

    test('reports an already committed save', async () => {
        store.saveProfile = failing('08006');
        const response = await call(formFor(update(), { avatar: true }));
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, cleanupPending: false });
        expect(deleted).toHaveLength(0);
    });

    test('discards the version after a definitive failure', async () => {
        store.saveProfile = failing('40001');
        store.profileWithAvatarVersion = async () => null;
        const conflict = await call(formFor(update(), { avatar: true }));
        expect(conflict.status).toBe(409);
        expect(deleted).toHaveLength(1);
        store.saveProfile = failing('23505');
        const rejected = await call(formFor(update(), { avatar: true }));
        expect(rejected.status).toBe(503);
        expect(deleted).toHaveLength(2);
        store.saveProfile = failing(undefined);
        expect((await call(formFor(update(), { avatar: true }))).status).toBe(503);
        expect(deleted).toHaveLength(2);
    });

    test('keeps the version when verification fails', async () => {
        store.saveProfile = failing('40001');
        store.profileWithAvatarVersion = async () => {
            throw new Error('db');
        };
        expect((await call(formFor(update(), { avatar: true }))).status).toBe(409);
        expect(deleted).toHaveLength(0);
    });

    test('maps failures without a new version', async () => {
        store.saveProfile = failing('40001');
        expect((await call(formFor(update()))).status).toBe(409);
        store.saveProfile = failing('XX000');
        expect((await call(formFor(update()))).status).toBe(503);
    });
});

describe('POST cleanup', () => {
    test('marks cleanup pending when promotion fails', async () => {
        store.saveProfile = async () => {
            bucket.failPut = true;
            return { status: 'saved', profile: {} };
        };
        const response = await call(formFor(update(), { avatar: true }));
        expect(await response.json()).toMatchObject({ cleanupPending: true });
    });

    test('marks cleanup pending when stale versions cannot be removed', async () => {
        store.claimIdentityCleanup = async () => {
            throw new Error('db');
        };
        const response = await call(formFor(update()));
        expect(await response.json()).toMatchObject({ cleanupPending: true });
    });

    test('marks cleanup pending without a database', async () => {
        store.saveProfile = async () => {
            state.service = undefined;
            return { status: 'saved', profile: {} };
        };
        const response = await call(formFor(update(), { avatar: true }));
        expect(await response.json()).toMatchObject({ cleanupPending: true });
    });

    test('skips promotion when the profile does not use the version', async () => {
        store.profileWithAvatarVersion = async () => null;
        const response = await call(formFor(update(), { avatar: true }));
        expect(await response.json()).toMatchObject({ cleanupPending: false });
    });
});
