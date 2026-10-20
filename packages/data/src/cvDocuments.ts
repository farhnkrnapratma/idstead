import type { ProjectRepoRules, SocialLink } from '@idstead/domain/author.ts';
import type { OpenPgpUserId, PublicOpenPgpKey } from '@idstead/domain/openpgpKey.ts';
import type { ProfileRecord } from './adminAuthor';

export interface CvSourceData {
    profile: ProfileRecord;
    experiences: Record<string, unknown>[];
    educations: Record<string, unknown>[];
    skills: Array<{ category: string; items: string[] }>;
    socials: SocialLink[];
    repoRules: ProjectRepoRules;
}

export interface StoredCvDocument {
    id: string;
    filename: string;
    file_url: string;
    signed_at: string | null;
}

export interface NewCvDocument {
    authorId: string;
    filename: string;
    fileUrl: string;
    hash: string;
    checksums: Record<string, string>;
    version: string;
}

export interface CvDocumentStore {
    sourceData(): Promise<CvSourceData | null>;
    active(): Promise<StoredCvDocument | null>;
    activeFilenames(): Promise<string[]>;
    findFilename(filename: string): Promise<string | null>;
    snapshot(documentId: string): Promise<unknown | null>;
    publish(document: NewCvDocument, snapshot: unknown): Promise<{ id: string }>;
    setChecksums(documentId: string, checksums: Record<string, string>): Promise<void>;
    setSignature(
        documentId: string,
        signature: { signedAt: string; fingerprint: string } | null
    ): Promise<void>;
    signerFingerprint(documentId: string): Promise<string | null>;
    delete(filename: string): Promise<boolean>;
    siteUrl(): Promise<string>;
    uploadFallback(key: string, body: Uint8Array, contentType: string): Promise<void>;
    removeFallback(keys: string[]): Promise<void>;
    fallbackUrl(key: string): string;
}

export interface OpenPgpKeyInput {
    fingerprint: string;
    armored: string;
    userIds: OpenPgpUserId[];
    algorithm: string;
    createdAt: string;
    expiresAt: string | null;
    keyservers: Array<{ label: string; url: string }>;
}

export interface OpenPgpKeyStore {
    active(): Promise<PublicOpenPgpKey | null>;
    removeActive(): Promise<void>;
    publish(key: OpenPgpKeyInput): Promise<void>;
}
