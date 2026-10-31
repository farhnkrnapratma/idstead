// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { AdminAuthorStore, AuthorWriter } from '../../packages/data/src/index.ts';
import { AUTHOR_SEED, type AuthorSeed } from './authorRepository.contract.ts';

export interface AdminAuthorSeed {
    author: AuthorSeed;
    identityVersions: Array<{ uuid: string; source: 'custom' | 'generated'; fingerprint: string }>;
}

export type AdminAuthorStoresFactory = (seed: AdminAuthorSeed) => {
    store: AdminAuthorStore;
    writer: AuthorWriter;
};

const ADMIN_AUTHOR_SEED: AdminAuthorSeed = {
    author: AUTHOR_SEED,
    identityVersions: [
        {
            uuid: AUTHOR_SEED.profile.avatarVersion!,
            source: 'generated',
            fingerprint: 'f'.repeat(64)
        }
    ]
};

const EMPTY_AUTHOR: AuthorSeed = {
    ...AUTHOR_SEED,
    links: [],
    experiences: [],
    educations: [],
    skills: [],
    repoRules: [],
    documents: [],
    openPgpKeys: []
};

export function adminAuthorContract(name: string, factory: AdminAuthorStoresFactory) {
    describe(`AdminAuthorStore contract: ${name}`, () => {
        test('the snapshot keeps the ids the admin editor keys its lists by', async () => {
            const snapshot = await factory(ADMIN_AUTHOR_SEED).store.snapshot();
            const { profile } = AUTHOR_SEED;
            expect(snapshot.profile).toMatchObject({
                id: profile.uuid,
                email: profile.email,
                revision: profile.revision,
                avatarVersion: profile.avatarVersion
            });
            expect(snapshot.identity).toEqual({
                avatar: { source: 'generated', fingerprint: 'f'.repeat(64) },
                banner: null
            });
            expect(snapshot.resume.experience.map(item => [item.id, item.title])).toEqual([
                [AUTHOR_SEED.experiences[1].uuid, 'First'],
                [AUTHOR_SEED.experiences[0].uuid, 'Second']
            ]);
            expect(snapshot.social.map(item => item.id)).toEqual([
                AUTHOR_SEED.links[1].uuid,
                AUTHOR_SEED.links[0].uuid
            ]);
            expect(snapshot.funding).toHaveLength(1);
            expect(snapshot.contact).toHaveLength(1);
            expect(snapshot.skills.map(item => item.id)).toEqual([AUTHOR_SEED.skills[0].uuid]);
            expect(snapshot.repoRules).toEqual({
                pinned: ['pinned-repo'],
                excluded: ['hidden-repo']
            });
            expect(snapshot.resumeDocument).toMatchObject({
                id: AUTHOR_SEED.documents[1].uuid,
                filename: 'resume.pdf'
            });
            expect(snapshot.openPgpKey?.fingerprint).toBe(AUTHOR_SEED.openPgpKeys[0].fingerprint);
        });

        test('reads the profile record and identity versions', async () => {
            const { store } = factory(ADMIN_AUTHOR_SEED);
            const record = await store.profileRecord();
            expect(record).toMatchObject({
                id: AUTHOR_SEED.profile.uuid,
                profile_revision: AUTHOR_SEED.profile.revision
            });
            expect(await store.profileRecord(AUTHOR_SEED.profile.uuid)).toMatchObject({
                id: AUTHOR_SEED.profile.uuid
            });
            expect(
                await store.profileWithAvatarVersion(AUTHOR_SEED.profile.avatarVersion!)
            ).toMatchObject({ id: AUTHOR_SEED.profile.uuid });
            expect(await store.identityVersions([])).toEqual([]);
            expect(
                (await store.identityVersions([AUTHOR_SEED.profile.avatarVersion!])).map(
                    row => row.id
                )
            ).toEqual([AUTHOR_SEED.profile.avatarVersion!]);
        });

        test('registers and deletes identity versions', async () => {
            const { store } = factory(ADMIN_AUTHOR_SEED);
            const id = '00000000-0000-4000-8000-000000000099';
            await store.registerIdentityVersion({
                id,
                kind: 'identity',
                source: 'custom',
                avatar_source: 'custom',
                banner_source: 'custom'
            });
            expect((await store.identityVersions([id])).map(row => row.id)).toEqual([id]);
            await store.deleteIdentityVersion(id);
            expect(await store.identityVersions([id])).toEqual([]);
        });

        test('returns the existing profile id', async () => {
            const { store } = factory(ADMIN_AUTHOR_SEED);
            expect(await store.ensureProfileId()).toBe(AUTHOR_SEED.profile.uuid);
        });

        test('an author without lists has an empty snapshot', async () => {
            const snapshot = await factory({
                author: EMPTY_AUTHOR,
                identityVersions: []
            }).store.snapshot();
            expect(snapshot).toMatchObject({
                resume: { experience: [], education: [] },
                skills: [],
                social: [],
                repoRules: { pinned: [], excluded: [] },
                resumeDocument: null,
                openPgpKey: null
            });
        });
    });
}
