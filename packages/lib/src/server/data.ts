import type { SupabaseClient } from '@supabase/supabase-js';
import {
    createSupabaseActivityLog,
    createSupabaseAdminActivityStore,
    createSupabaseAdminAuthorStore,
    createSupabaseAdminPostStores,
    createSupabaseAdminSettingsStore,
    createSupabaseArdIndexStore,
    createSupabaseAuthorWriter,
    createSupabaseCvDocumentStore,
    createSupabaseIdentityVersionReader,
    createSupabaseLegalPageWriter,
    createSupabaseLoginLockoutStore,
    createSupabaseOpenPgpKeyStore,
    createSupabaseRenderStore,
    createSupabaseRepositories,
    createSupabaseSiteDataStore,
    createSupabaseWriters,
    type ActivityLog,
    type AdminActivityStore,
    type AdminAuthorStore,
    type AdminPostStores,
    type AdminSettingsStore,
    type ArdIndexStore,
    type AuthorWriter,
    type CvDocumentStore,
    type IdentityVersionReader,
    type LegalPageWriter,
    type LoginLockoutStore,
    type OpenPgpKeyStore,
    type PostRenderStore,
    type Repositories,
    type SiteDataStore,
    type Writers
} from '@idstead/data';
import { supabase } from '#lib/supabase.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { getSupabaseUserClient } from './supabaseUser';

export interface PublicStores extends Repositories {
    identity: IdentityVersionReader;
}

export interface ServiceStores extends Repositories {
    writers: Writers;
    identity: IdentityVersionReader;
    ard: ArdIndexStore;
    lockout: LoginLockoutStore;
    renders: PostRenderStore;
    activityLog: ActivityLog;
    adminActivity: AdminActivityStore;
    adminSettings: AdminSettingsStore;
    adminAuthor: AdminAuthorStore;
    adminPosts: AdminPostStores;
    cvDocuments: CvDocumentStore;
    openPgpKeys: OpenPgpKeyStore;
    siteData: SiteDataStore;
}

export interface SessionStores {
    authorWriter: AuthorWriter;
    legalWriter: LegalPageWriter;
    adminActivity: AdminActivityStore;
}

export interface DataStores {
    readonly public: PublicStores;
    readonly service: ServiceStores | null;
    readonly session: SessionStores | null;
}

export interface DataStoreOptions {
    request?: Request;
    fetch?: typeof fetch;
    bannerUrls?: boolean;
}

export class DataBackendError extends Error {
    constructor(backend: string) {
        super(`Unknown DATA_BACKEND "${backend}".`);
        this.name = 'DataBackendError';
    }
}

type PlatformEnv = { env?: Record<string, unknown> } | undefined;

function dataBackend(platform: unknown) {
    const configured =
        (platform as PlatformEnv)?.env?.DATA_BACKEND ?? process.env.DATA_BACKEND ?? 'supabase';
    const backend = String(configured).trim() || 'supabase';
    if (backend !== 'supabase') throw new DataBackendError(backend);
    return backend;
}

function supabasePublicStores(db: SupabaseClient, options: DataStoreOptions): PublicStores {
    return {
        ...createSupabaseRepositories(db, {
            fetch: options.fetch,
            ...(options.bannerUrls === false ? {} : { cdnBase: cdnBaseUrl() })
        }),
        identity: createSupabaseIdentityVersionReader(db)
    };
}

function supabaseServiceStores(db: SupabaseClient): ServiceStores {
    return {
        ...createSupabaseRepositories(db),
        writers: createSupabaseWriters(db),
        identity: createSupabaseIdentityVersionReader(db),
        ard: createSupabaseArdIndexStore(db),
        lockout: createSupabaseLoginLockoutStore(db),
        renders: createSupabaseRenderStore(db),
        activityLog: createSupabaseActivityLog(db),
        adminActivity: createSupabaseAdminActivityStore(db),
        adminSettings: createSupabaseAdminSettingsStore(db),
        adminAuthor: createSupabaseAdminAuthorStore(db),
        adminPosts: createSupabaseAdminPostStores(db),
        cvDocuments: createSupabaseCvDocumentStore(db),
        openPgpKeys: createSupabaseOpenPgpKeyStore(db),
        siteData: createSupabaseSiteDataStore(db)
    };
}

function supabaseSessionStores(db: SupabaseClient): SessionStores {
    return {
        authorWriter: createSupabaseAuthorWriter(db),
        legalWriter: createSupabaseLegalPageWriter(db),
        adminActivity: createSupabaseAdminActivityStore(db)
    };
}

export function dataStores(platform?: unknown, options: DataStoreOptions = {}): DataStores {
    dataBackend(platform);
    let publicStores: PublicStores | undefined;
    let serviceStores: ServiceStores | null | undefined;
    let sessionStores: SessionStores | null | undefined;
    return {
        get public() {
            return (publicStores ??= supabasePublicStores(supabase, options));
        },
        get service() {
            if (serviceStores === undefined) {
                const db = getSupabaseAdminClient(platform);
                serviceStores = db ? supabaseServiceStores(db) : null;
            }
            return serviceStores;
        },
        get session() {
            if (sessionStores === undefined) {
                const db =
                    options.request ? getSupabaseUserClient(options.request, platform) : null;
                sessionStores = db ? supabaseSessionStores(db) : null;
            }
            return sessionStores;
        }
    };
}
