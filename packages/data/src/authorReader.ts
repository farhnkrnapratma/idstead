// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
    contactLinkFromRow,
    resumeDocumentFromRow,
    educationFromRow,
    experienceFromRow,
    fundingLinkFromRow,
    skillGroupFromItem,
    skillItemFromRow,
    socialLinkFromRow,
    type AuthorProfile,
    type ResumeDocument,
    type ProjectRepoRules
} from '@idstead/domain/author.ts';
import { identityVersionToken } from '@idstead/domain/hash.ts';
import type { PublicOpenPgpKey } from '@idstead/domain/openpgpKey.ts';
import type { AuthorRepository } from './author';

export type Row = Record<string, any>;

function withoutId<T extends { id?: unknown }>(item: T): T {
    const { id: _id, ...rest } = item;
    return rest as T;
}

export async function publicProfile(profile: AuthorProfile): Promise<AuthorProfile> {
    const { id: _id, revision: _revision, ...rest } = profile;
    return {
        ...rest,
        avatarVersion: await identityVersionToken(profile.avatarVersion),
        bannerVersion: await identityVersionToken(profile.bannerVersion)
    };
}

export interface AuthorReader {
    profile(options?: { includeEmail?: boolean }): Promise<AuthorProfile | null>;
    links(category: 'social' | 'funding' | 'contact'): Promise<Row[]>;
    experience(): Promise<Row[]>;
    education(): Promise<Row[]>;
    skills(): Promise<Row[]>;
    projectRepoRules(): Promise<ProjectRepoRules>;
    activeResumeDocument(): Promise<ResumeDocument | null>;
    activeOpenPgpKey(): Promise<PublicOpenPgpKey | null>;
    siteUrl(): Promise<string>;
}

export async function resumeDocumentWithHash(
    data: Row,
    fetchFn: typeof fetch
): Promise<ResumeDocument> {
    let hash: string = data.hash || '';
    if (hash.length < 64 && data.file_url) {
        try {
            const response = await fetchFn(`${data.file_url}.sha256`);
            const match =
                response.ok ? (await response.text()).trim().match(/^[a-fA-F0-9]{64}/) : null;
            if (match) hash = match[0];
        } catch {}
    }
    return resumeDocumentFromRow(data, hash);
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

        async resumeEntries() {
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

        async activeResumeDocument() {
            const document = await reader.activeResumeDocument();
            return document ? withoutId(document) : null;
        },

        activeOpenPgpKey: () => reader.activeOpenPgpKey(),

        siteUrl: () => reader.siteUrl()
    };
}
