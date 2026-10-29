import { describe, expect, test } from 'bun:test';
import {
    createD1AdminAuthorStore,
    createD1AuthorWriter
} from '../packages/data/src/d1/adminAuthor.ts';
import { createD1AuthorRepository } from '../packages/data/src/d1/author.ts';
import { d1Shim } from './support/d1.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ASSETS = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'avatar.avif',
    'avatar.png',
    'avatar.webp',
    'banner-og.webp',
    'banner.avif',
    'banner.webp',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'favicon.svg'
].map(name => ({ name, key: `identity/v/${name}` }));

const profile = {
    name: 'Ada',
    username: 'ada',
    headline: 'Engineer',
    job_title: 'Engineer',
    bio: 'Bio',
    email: 'ada@example.com',
    city: 'City',
    postal_code: '1',
    country: 'ID',
    site_url: 'https://example.com/',
    pronunciation: null
};

async function registered(store: ReturnType<typeof createD1AdminAuthorStore>, id: string) {
    await store.registerIdentityVersion({
        id,
        kind: 'identity',
        source: 'custom',
        avatar_source: 'custom',
        banner_source: 'custom',
        assets: [],
        retired_at: new Date().toISOString()
    });
}

describe('D1 admin author store', () => {
    test('creates the first profile with its identity package and updates it at its revision', async () => {
        const { db, sqlite } = d1Shim();
        const store = createD1AdminAuthorStore(db);
        expect(await store.saveProfile(profile, null)).toMatchObject({
            status: 'failed',
            code: 'P0001'
        });
        await registered(store, uuid(1));
        expect(
            await store.saveProfile(profile, { version: uuid(1), assets: ASSETS.slice(1) })
        ).toMatchObject({ status: 'failed', message: 'Incomplete identity package' });
        const created = await store.saveProfile(profile, { version: uuid(1), assets: ASSETS });
        expect(created).toMatchObject({
            status: 'saved',
            profile: {
                name: 'Ada',
                avatar: 'https://example.com/avatar.png',
                avatar_version: uuid(1),
                banner_version: uuid(1),
                manifest_settings: { display: 'standalone', theme_color: '#09090b' }
            }
        });
        const record = (await store.profileRecord())!;
        expect(
            await store.saveProfile({ ...profile, id: record.id, revision: 99 }, null)
        ).toMatchObject({ status: 'failed', code: '40001' });
        await registered(store, uuid(2));
        const updated = await store.saveProfile(
            {
                id: record.id,
                revision: record.profile_revision,
                name: 'Ada L.',
                manifest_settings: { theme_color: '#112233' }
            },
            { version: uuid(2), assets: ASSETS }
        );
        expect(updated).toMatchObject({
            status: 'saved',
            profile: {
                name: 'Ada L.',
                username: 'ada',
                avatar_version: uuid(2),
                manifest_settings: { theme_color: '#112233', background_color: '#09090b' }
            }
        });
        expect(
            sqlite
                .query(
                    'select profile_id, retired_at is not null as retired from db_identity_versions where id = ?'
                )
                .get(uuid(1))
        ).toEqual({ profile_id: record.id, retired: 1 });
        expect(await store.claimIdentityCleanup()).toEqual([uuid(1)]);
        expect(
            await store.saveProfile(
                { ...profile, username: 'other' },
                { version: uuid(3), assets: ASSETS }
            )
        ).toMatchObject({ status: 'failed', code: '40001' });
    });

    test('adopts the blank profile shell on the first profile save', async () => {
        const { db } = d1Shim();
        const store = createD1AdminAuthorStore(db);
        const author = createD1AuthorRepository(db);
        const shellId = await store.ensureProfileId();
        expect(await author.profile()).toBeNull();
        await registered(store, uuid(1));
        expect(
            await store.saveProfile(profile, { version: uuid(1), assets: ASSETS })
        ).toMatchObject({ status: 'saved', profile: { name: 'Ada', avatar_version: uuid(1) } });
        expect((await store.profileRecord())?.id).toBe(shellId);
        expect(await author.profile()).toMatchObject({ name: 'Ada' });
    });

    test('creates an empty profile shell only once', async () => {
        const { db } = d1Shim();
        const store = createD1AdminAuthorStore(db);
        const id = await store.ensureProfileId();
        expect(await store.ensureProfileId()).toBe(id);
        expect(await store.identityDefaults()).toEqual({
            theme_color: '#09090b',
            background_color: '#09090b',
            display: 'standalone'
        });
    });
});

describe('D1 author writer', () => {
    test('replaces the resume, skills, links and repository rules of the author', async () => {
        const { db } = d1Shim();
        const store = createD1AdminAuthorStore(db);
        const writer = createD1AuthorWriter(db);
        const author = createD1AuthorRepository(db);
        const id = await store.ensureProfileId();
        expect(
            await writer.saveResume(
                id,
                [
                    {
                        title: 'Engineer',
                        company: 'Co',
                        start_month: 'mar',
                        start_year: '2024',
                        currently_in: true
                    }
                ],
                [{ institution: 'Uni', start_year: 2018, end_year: '', end_month: '' }]
            )
        ).toEqual({ status: 'saved' });
        const resume = await author.resumeEntries();
        expect(resume.experience).toHaveLength(1);
        expect(resume.education).toHaveLength(1);
        expect(
            await writer.saveResume(id, [{ title: 'Bad', start_year: 'soon' }], [])
        ).toMatchObject({ status: 'rejected' });
        expect((await author.resumeEntries()).experience).toHaveLength(1);
        await writer.saveSkills(id, [{ category: 'Languages', skills: ['Rust', 'TypeScript'] }]);
        expect((await author.skillGroups())[0]).toMatchObject({ category: 'Languages' });
        expect(
            await writer.saveLinks(id, 'social', [
                { platform: 'GitHub', url: 'https://github.com/a', icon: '' }
            ])
        ).toEqual({ status: 'saved' });
        expect((await author.socialLinks())[0]).toMatchObject({ platform: 'GitHub' });
        expect(
            await writer.saveLinks(
                id,
                'social',
                Array.from({ length: 11 }, () => ({ platform: 'X', url: 'https://x.com' }))
            )
        ).toMatchObject({ status: 'rejected' });
        expect(
            await writer.saveRepoRules(id, { pinned: ['a', 'b', 'c', 'd'], excluded: [] })
        ).toEqual({ status: 'rejected', message: 'Maximum of 3 pinned repos allowed' });
        await writer.saveRepoRules(id, { pinned: ['a'], excluded: ['b'] });
        expect(await author.projectRepoRules()).toEqual({ pinned: ['a'], excluded: ['b'] });
    });
});
