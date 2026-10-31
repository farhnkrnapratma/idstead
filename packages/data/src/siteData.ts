import type { PostAssetState } from './adminPosts';

export type ExportRow = Record<string, any>;

export interface ExportTables {
    posts: ExportRow[];
    comments: ExportRow[];
    reports: ExportRow[];
    feedback: ExportRow[];
    legals: ExportRow[];
    repoRules: ExportRow[];
    activeDocuments: ExportRow[];
    settings: ExportRow[];
    siteSettings: ExportRow[];
    subscribers: ExportRow[];
    avatarVersion: string | null;
}

export interface ExportFailure {
    scope: string;
    error: unknown;
}

export interface DeletionPlan {
    documents: string[];
    identityVersions: string[];
    posts: PostAssetState[];
}

export interface SiteDataStore {
    exportTables(): Promise<{ tables: ExportTables; failures: ExportFailure[] }>;
    postMarkdown(storagePath: string): Promise<string>;
    deletionPlan(): Promise<DeletionPlan>;
    clearAll(): Promise<void>;
}
