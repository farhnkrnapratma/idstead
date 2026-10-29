import { describe, expect, test } from 'bun:test';
import type { AuthorRepository } from '../../packages/data/src/index.ts';

export interface AuthorSeed {
    profile: {
        uuid: string;
        name: string;
        headline: string;
        email: string;
        siteUrl: string;
        avatarVersion: string | null;
        revision: number;
    };
    links: Array<{
        uuid: string;
        category: 'social' | 'funding' | 'contact';
        platform: string;
        url: string;
        displayValue?: string;
        sortOrder: number;
    }>;
    experiences: Array<{ uuid: string; title: string; startMonth: string; sortOrder: number }>;
    educations: Array<{ uuid: string; institution: string; startMonth: string; sortOrder: number }>;
    skills: Array<{
        uuid: string;
        category: string;
        sortOrder: number;
        items: Array<{ uuid: string; name: string; sortOrder: number }>;
    }>;
    repoRules: Array<{ type: 'exclude' | 'pin'; repo: string; sortOrder: number }>;
    documents: Array<{
        uuid: string;
        filename: string;
        fileUrl: string;
        hash: string;
        active: boolean;
        sortOrder: number;
    }>;
    files: Record<string, string>;
    openPgpKeys: Array<{ fingerprint: string; active: boolean; keyservers: unknown[] }>;
}

export type AuthorRepositoryFactory = (seed: AuthorSeed) => AuthorRepository;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FINGERPRINT = '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C';

export const AUTHOR_SEED: AuthorSeed = {
    profile: {
        uuid: uuid(1),
        name: 'Ada &amp; Co',
        headline: 'Engineer',
        email: 'ada@example.com',
        siteUrl: 'https://example.com',
        avatarVersion: uuid(2),
        revision: 7
    },
    links: [
        { uuid: uuid(10), category: 'social', platform: 'X', url: 'https://x.com/a', sortOrder: 2 },
        {
            uuid: uuid(11),
            category: 'social',
            platform: 'GitHub',
            url: 'https://github.com/a',
            sortOrder: 1
        },
        {
            uuid: uuid(12),
            category: 'funding',
            platform: 'Ko-fi',
            url: 'https://ko-fi.com/a',
            displayValue: '@a',
            sortOrder: 1
        },
        {
            uuid: uuid(13),
            category: 'contact',
            platform: 'Email',
            url: 'mailto:a@example.com',
            displayValue: 'a@example.com',
            sortOrder: 1
        }
    ],
    experiences: [
        { uuid: uuid(20), title: 'Second', startMonth: 'feb', sortOrder: 2 },
        { uuid: uuid(21), title: 'First', startMonth: 'jan', sortOrder: 1 }
    ],
    educations: [{ uuid: uuid(30), institution: 'Uni', startMonth: '09', sortOrder: 1 }],
    skills: [
        {
            uuid: uuid(40),
            category: 'Languages',
            sortOrder: 1,
            items: [
                { uuid: uuid(41), name: 'Rust', sortOrder: 2 },
                { uuid: uuid(42), name: 'TypeScript', sortOrder: 1 }
            ]
        }
    ],
    repoRules: [
        { type: 'pin', repo: 'pinned-repo', sortOrder: 1 },
        { type: 'exclude', repo: 'hidden-repo', sortOrder: 2 }
    ],
    documents: [
        {
            uuid: uuid(50),
            filename: 'old.pdf',
            fileUrl: 'https://storage.test/old.pdf',
            hash: 'f'.repeat(64),
            active: false,
            sortOrder: 1
        },
        {
            uuid: uuid(51),
            filename: 'resume.pdf',
            fileUrl: 'https://storage.test/resume.pdf',
            hash: '',
            active: true,
            sortOrder: 2
        }
    ],
    files: { 'https://storage.test/resume.pdf.sha256': `${'a'.repeat(64)}  resume.pdf\n` },
    openPgpKeys: [
        {
            fingerprint: FINGERPRINT,
            active: true,
            keyservers: [
                { label: 'keys', url: 'https://keys.openpgp.org/x' },
                { label: 'bad', url: 'javascript:alert(1)' }
            ]
        }
    ]
};

export function authorRepositoryContract(name: string, factory: AuthorRepositoryFactory) {
    describe(`${name}: AuthorRepository contract`, () => {
        const author = factory(AUTHOR_SEED);

        test('returns the public profile without IDs, revision or raw identity versions', async () => {
            const profile = (await author.profile())!;
            expect(profile.name).toBe('Ada & Co');
            expect(profile.email).toBe('');
            expect(profile).not.toHaveProperty('id');
            expect(profile).not.toHaveProperty('revision');
            expect(profile.avatarVersion).toMatch(/^[0-9a-f]{16}$/);
            expect(profile.avatarVersion).toBe((await author.profile())!.avatarVersion);
            expect(profile.bannerVersion).toBeNull();
            expect((await author.profile({ includeEmail: true }))!.email).toBe('ada@example.com');
            expect(await author.siteUrl()).toBe('https://example.com');
        });

        test('returns links by category in sort order', async () => {
            expect((await author.socialLinks()).map(link => link.platform)).toEqual([
                'GitHub',
                'X'
            ]);
            expect((await author.fundingLinks()).map(link => link.displayValue)).toEqual(['@a']);
            expect((await author.contactLinks()).map(link => link.href)).toEqual([
                'mailto:a@example.com'
            ]);
        });

        test('returns resume entries and skills in order with readable months', async () => {
            const { experience, education } = await author.resumeEntries();
            expect(experience.map(item => [item.title, item.startMonth])).toEqual([
                ['First', 'January'],
                ['Second', 'February']
            ]);
            expect(education.map(item => item.startMonth)).toEqual(['September']);
            expect(await author.skillGroups()).toEqual([
                { category: 'Languages', items: ['TypeScript', 'Rust'], sortOrder: 1 }
            ]);
        });

        test('returns project repo rules', async () => {
            expect(await author.projectRepoRules()).toEqual({
                excluded: ['hidden-repo'],
                pinned: ['pinned-repo']
            });
        });

        test('returns the active resume document with a full hash', async () => {
            const document = (await author.activeResumeDocument())!;
            expect(document.filename).toBe('resume.pdf');
            expect(document.hash).toBe('a'.repeat(64));
            expect(document).not.toHaveProperty('id');
        });

        test('returns the active OpenPGP key with safe keyservers only', async () => {
            const key = (await author.activeOpenPgpKey())!;
            expect(key.fingerprint).toBe(FINGERPRINT);
            expect(key.keyservers.map(server => server.label)).toEqual(['keys']);
        });

        test('never exposes database UUIDs', async () => {
            const output = JSON.stringify([
                await author.profile({ includeEmail: true }),
                await author.socialLinks(),
                await author.fundingLinks(),
                await author.contactLinks(),
                await author.resumeEntries(),
                await author.skillGroups(),
                await author.activeResumeDocument()
            ]);
            expect(output).not.toMatch(UUID);
        });
    });
}
