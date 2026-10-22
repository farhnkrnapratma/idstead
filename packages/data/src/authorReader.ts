import {
    contactLinkFromRow,
    cvDocumentFromRow,
    educationFromRow,
    experienceFromRow,
    fundingLinkFromRow,
    skillGroupFromItem,
    skillItemFromRow,
    socialLinkFromRow,
    type AuthorProfile,
    type CvDocument,
    type ProjectRepoRules
} from '@idstead/domain/author.ts';
import type { PublicOpenPgpKey } from '@idstead/domain/openpgpKey.ts';
import type { AuthorRepository } from './author';

export type Row = Record<string, any>;

function withoutId<T extends { id?: unknown }>(item: T): T {
    const { id: _id, ...rest } = item;
    return rest as T;
}

async function versionToken(version: unknown): Promise<string | null> {
    if (typeof version !== 'string' || !version) return null;
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`identity-version:${version}`)
    );
    return Array.from(new Uint8Array(digest).slice(0, 8), byte =>
        byte.toString(16).padStart(2, '0')
    ).join('');
}

export async function publicProfile(profile: AuthorProfile): Promise<AuthorProfile> {
    const { id: _id, revision: _revision, ...rest } = profile;
    return {
        ...rest,
        avatarVersion: await versionToken(profile.avatarVersion),
        bannerVersion: await versionToken(profile.bannerVersion)
    };
}

export interface AuthorReader {
    profile(options?: { includeEmail?: boolean }): Promise<AuthorProfile | null>;
    links(category: 'social' | 'funding' | 'contact'): Promise<Row[]>;
    experience(): Promise<Row[]>;
    education(): Promise<Row[]>;
    skills(): Promise<Row[]>;
    projectRepoRules(): Promise<ProjectRepoRules>;
    activeCvDocument(): Promise<CvDocument | null>;
    activeOpenPgpKey(): Promise<PublicOpenPgpKey | null>;
    siteUrl(): Promise<string>;
}

export async function cvDocumentWithHash(data: Row, fetchFn: typeof fetch): Promise<CvDocument> {
    let hash: string = data.hash || '';
    if (hash.length < 64 && data.file_url) {
        try {
            const response = await fetchFn(`${data.file_url}.sha256`);
            const match =
                response.ok ? (await response.text()).trim().match(/^[a-fA-F0-9]{64}/) : null;
            if (match) hash = match[0];
        } catch {}
    }
    return cvDocumentFromRow(data, hash);
}

export function authorRepositoryFromReader(reader: AuthorReader): AuthorRepository {
    return {
        async profile(settings = {}) {
            const profile = await reader.profile(settings);
            return profile ? publicProfile(profile) : null;
        },

        async socialLinks() {
            return (await reader.links('social')).map(row => withoutId(socialLinkFromRow(row)));
        },

        async fundingLinks() {
            return (await reader.links('funding')).map(row => withoutId(fundingLinkFromRow(row)));
        },

        async contactLinks() {
            return (await reader.links('contact')).map(row => withoutId(contactLinkFromRow(row)));
        },

        async cvEntries() {
            const [experience, education] = await Promise.all([
                reader.experience(),
                reader.education()
            ]);
            return {
                experience: experience.map(row => withoutId(experienceFromRow(row))),
                education: education.map(row => withoutId(educationFromRow(row)))
            };
        },

        async skillGroups() {
            return (await reader.skills()).map(row =>
                withoutId(skillGroupFromItem(skillItemFromRow(row)))
            );
        },

        projectRepoRules: () => reader.projectRepoRules(),

        async activeCvDocument() {
            const document = await reader.activeCvDocument();
            return document ? withoutId(document) : null;
        },

        activeOpenPgpKey: () => reader.activeOpenPgpKey(),

        siteUrl: () => reader.siteUrl()
    };
}
