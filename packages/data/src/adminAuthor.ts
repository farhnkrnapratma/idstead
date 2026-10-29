import type {
    AuthorProfile,
    ContactInfo,
    ResumeDocument,
    ProjectRepoRules,
    SkillItem,
    SocialLink,
    SponsorshipLink
} from '@idstead/domain/author.ts';
import type { PublicOpenPgpKey } from '@idstead/domain/openpgpKey.ts';
import type { ResumeEntries } from './author';

export type IdentitySource = 'custom' | 'generated';

export interface IdentityVersionMeta {
    source: IdentitySource;
    fingerprint: string | null;
}

export interface AdminAuthorSnapshot {
    profile: AuthorProfile | null;
    identity: { avatar: IdentityVersionMeta | null; banner: IdentityVersionMeta | null };
    resume: ResumeEntries;
    skills: SkillItem[];
    social: SocialLink[];
    funding: SponsorshipLink[];
    contact: ContactInfo[];
    repoRules: ProjectRepoRules;
    resumeDocument: ResumeDocument | null;
    openPgpKey: PublicOpenPgpKey | null;
}

export type ProfileRecord = Record<string, unknown> & {
    id: string;
    profile_revision: number;
    avatar_version: string | null;
    banner_version: string | null;
};

export type IdentityVersionRecord = Record<string, unknown> & { id: string };

export type ProfileSave =
    | { status: 'saved'; profile: Record<string, unknown> }
    | { status: 'failed'; code: string | null; message: string };

export interface AdminAuthorStore {
    snapshot(): Promise<AdminAuthorSnapshot>;
    profile(): Promise<AuthorProfile | null>;
    resumeEntries(): Promise<ResumeEntries>;
    ensureProfileId(): Promise<string>;
    profileRecord(id?: string): Promise<ProfileRecord | null>;
    profileWithAvatarVersion(version: string): Promise<ProfileRecord | null>;
    saveProfile(
        profile: Record<string, unknown>,
        identity: Record<string, unknown> | null
    ): Promise<ProfileSave>;
    identityDefaults(): Promise<unknown>;
    identityVersions(ids: string[]): Promise<IdentityVersionRecord[]>;
    registerIdentityVersion(version: IdentityVersionRecord): Promise<void>;
    deleteIdentityVersion(id: string): Promise<void>;
    claimIdentityCleanup(): Promise<string[]>;
}

export type LinkCategory = 'social' | 'funding' | 'contact';

export type AuthorWrite = { status: 'saved' } | { status: 'rejected'; message: string };

export interface AuthorWriter {
    saveResume(
        authorId: string,
        experiences: Record<string, unknown>[],
        education: Record<string, unknown>[]
    ): Promise<AuthorWrite>;
    saveSkills(authorId: string, categories: Record<string, unknown>[]): Promise<AuthorWrite>;
    saveLinks(
        authorId: string,
        category: LinkCategory,
        items: Record<string, unknown>[]
    ): Promise<AuthorWrite>;
    saveRepoRules(authorId: string, rules: ProjectRepoRules): Promise<AuthorWrite>;
}
