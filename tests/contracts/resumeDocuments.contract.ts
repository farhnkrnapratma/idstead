// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { ResumeDocumentStore, OpenPgpKeyStore } from '../../packages/data/src/index.ts';
import { AUTHOR_SEED, type AuthorSeed } from './authorRepository.contract.ts';

export interface ResumeDocumentSeed {
    author: AuthorSeed;
    snapshots: Array<{ documentUuid: string; content: unknown }>;
}

export type ResumeDocumentStoresFactory = (seed: ResumeDocumentSeed) => {
    documents: ResumeDocumentStore;
    keys: OpenPgpKeyStore;
};

const RESUME_DOCUMENT_SEED: ResumeDocumentSeed = {
    author: AUTHOR_SEED,
    snapshots: [{ documentUuid: AUTHOR_SEED.documents[1].uuid, content: { version: 1 } }]
};

const ACTIVE = AUTHOR_SEED.documents[1];
const NEW_KEY = {
    fingerprint: 'B'.repeat(40),
    armored: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nnew',
    userIds: [{ name: 'Ada', email: 'ada@example.com' }],
    algorithm: 'Ed25519',
    createdAt: '2026-10-01T00:00:00Z',
    expiresAt: null,
    keyservers: [{ label: 'keys', url: 'https://keys.openpgp.org/' }]
};

export function resumeDocumentContract(name: string, factory: ResumeDocumentStoresFactory) {
    describe(`ResumeDocumentStore contract: ${name}`, () => {
        test('collects the data a resume is generated from', async () => {
            const source = await factory(RESUME_DOCUMENT_SEED).documents.sourceData();
            expect(source?.profile.id).toBe(AUTHOR_SEED.profile.uuid);
            expect(source?.experiences.map(item => item.title)).toEqual(['First', 'Second']);
            expect(source?.skills).toEqual([
                { category: 'Languages', items: ['TypeScript', 'Rust'] }
            ]);
            expect(source?.socials.map(link => link.platform)).toEqual(['GitHub', 'X']);
            expect(source?.repoRules).toEqual({
                pinned: ['pinned-repo'],
                excluded: ['hidden-repo']
            });
        });

        test('finds the active document, its snapshot and filenames', async () => {
            const { documents } = factory(RESUME_DOCUMENT_SEED);
            expect(await documents.active()).toMatchObject({
                id: ACTIVE.uuid,
                filename: ACTIVE.filename,
                file_url: ACTIVE.fileUrl,
                signed_at: null
            });
            expect(await documents.activeFilenames()).toEqual([ACTIVE.filename]);
            expect(await documents.findFilename('old.pdf')).toBe('old.pdf');
            expect(await documents.findFilename('missing.pdf')).toBeNull();
            expect(await documents.snapshot(ACTIVE.uuid)).toEqual({ version: 1 });
            expect(await documents.snapshot(AUTHOR_SEED.documents[0].uuid)).toBeNull();
        });

        test('publishing a version makes it the only active document', async () => {
            const { documents } = factory(RESUME_DOCUMENT_SEED);
            const { id } = await documents.publish(
                {
                    authorId: AUTHOR_SEED.profile.uuid,
                    filename: 'resume-v2.pdf',
                    fileUrl: 'https://storage.test/resume-v2.pdf',
                    hash: 'c'.repeat(64),
                    checksums: { sha256: 'c'.repeat(64) },
                    version: '2.0'
                },
                { version: 2 }
            );
            expect(await documents.activeFilenames()).toEqual(['resume-v2.pdf']);
            expect(await documents.snapshot(id)).toEqual({ version: 2 });
        });

        test('records and clears a signature', async () => {
            const { documents } = factory(RESUME_DOCUMENT_SEED);
            await documents.setSignature(ACTIVE.uuid, {
                signedAt: '2026-10-02T00:00:00Z',
                fingerprint: 'A'.repeat(40)
            });
            expect((await documents.active())?.signed_at).toBe('2026-10-02T00:00:00Z');
            expect(await documents.signerFingerprint(ACTIVE.uuid)).toBe('A'.repeat(40));
            await documents.setSignature(ACTIVE.uuid, null);
            expect(await documents.signerFingerprint(ACTIVE.uuid)).toBeNull();
        });

        test('deletes a document by filename', async () => {
            const { documents } = factory(RESUME_DOCUMENT_SEED);
            expect(await documents.delete(ACTIVE.filename)).toBe(true);
            expect(await documents.active()).toBeNull();
        });

        test('reads the site URL for verification links', async () => {
            expect(await factory(RESUME_DOCUMENT_SEED).documents.siteUrl()).toBe(
                AUTHOR_SEED.profile.siteUrl
            );
        });
    });

    describe(`OpenPgpKeyStore contract: ${name}`, () => {
        test('publishing a new key replaces the active one', async () => {
            const { keys } = factory(RESUME_DOCUMENT_SEED);
            await keys.publish(NEW_KEY);
            expect(await keys.active()).toMatchObject({
                fingerprint: NEW_KEY.fingerprint,
                algorithm: 'Ed25519'
            });
        });

        test('republishing the active key updates its keyservers', async () => {
            const { keys } = factory(RESUME_DOCUMENT_SEED);
            await keys.publish(NEW_KEY);
            await keys.publish({
                ...NEW_KEY,
                keyservers: [{ label: 'ubuntu', url: 'https://keyserver.ubuntu.com/' }]
            });
            expect((await keys.active())?.keyservers).toEqual([
                { label: 'ubuntu', url: 'https://keyserver.ubuntu.com/' }
            ]);
        });

        test('removes the active key', async () => {
            const { keys } = factory(RESUME_DOCUMENT_SEED);
            await keys.removeActive();
            expect(await keys.active()).toBeNull();
        });
    });
}
