import {
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
    type MaintenanceStore,
    type OidcAuthStore,
    type OidcClientStore,
    type OpenPgpKeyStore,
    type PostRenderStore,
    type Repositories,
    type SiteDataStore,
    type Writers,
    createD1ActivityLog,
    createD1AdminActivityStore,
    createD1AdminAuthorStore,
    createD1AdminNotifier,
    createD1AdminPostStore,
    createD1AdminSettingsStore,
    createD1ArdIndexStore,
    createD1AuthorRepository,
    createD1AuthorWriter,
    createD1BlogRepository,
    createD1CommentRepository,
    createD1CommentWriter,
    createD1CvDocumentStore,
    createD1FeedbackRecorder,
    createD1IdentityVersionReader,
    createD1LegalPageRepository,
    createD1LegalPageWriter,
    createD1LoginLockoutStore,
    createD1MaintenanceStore,
    createD1NewsletterStore,
    createD1OidcAuthStore,
    createD1OidcClientStore,
    createD1OpenPgpKeyStore,
    createD1PostCleanupStore,
    createD1PostOperationStore,
    createD1RenderStore,
    createD1SiteDataStore,
    createD1SubscriberRepository,
    createD1ViewRecorder,
    type ContentBucket,
    type D1Like,
    cachedRepositories,
    createD1CacheGenerations
} from '@idstead/data';
import * as privateEnv from '$app/env/private';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { lazyBucket, lazyD1 } from './lazyBindings';
import { workerBinding } from './workerEnv';
import { workersResultCache } from './resultCache';

export interface PublicStores extends Repositories {
    identity: IdentityVersionReader;
}

export interface ServiceStores extends Repositories {
    writers: Writers;
    identity: IdentityVersionReader;
    ard: ArdIndexStore;
    lockout: LoginLockoutStore;
    maintenance: MaintenanceStore;
    renders: PostRenderStore;
    activityLog: ActivityLog;
    adminActivity: AdminActivityStore;
    adminSettings: AdminSettingsStore;
    adminAuthor: AdminAuthorStore;
    adminPosts: AdminPostStores;
    cvDocuments: CvDocumentStore;
    openPgpKeys: OpenPgpKeyStore;
    siteData: SiteDataStore;
    authorWriter: AuthorWriter;
    legalWriter: LegalPageWriter;
    oidcClients: OidcClientStore;
    oidcAuth: OidcAuthStore;
}

export interface DataStores {
    readonly public: PublicStores;
    readonly service: ServiceStores;
}

export interface DataStoreOptions {
    fetch?: typeof fetch;
    bannerUrls?: boolean;
}

type PlatformEnv = { env?: Record<string, unknown> } | undefined;

function binding<T>(platform: unknown, name: string): () => Promise<T> {
    let loaded: Promise<T> | undefined;
    return () =>
        (loaded ??= (async () => {
            const value = (platform as PlatformEnv)?.env?.[name] ?? (await workerBinding(name));
            if (!value) throw new Error(`The ${name} binding is not configured.`);
            return value as T;
        })());
}

interface D1Backend {
    db: D1Like;
    bucket: ContentBucket;
}

function d1Repositories({ db, bucket }: D1Backend, options: DataStoreOptions = {}): Repositories {
    return {
        author: createD1AuthorRepository(db, { fetch: options.fetch }),
        blog: createD1BlogRepository(db, bucket, {
            ...(options.bannerUrls === false ? {} : { cdnBase: cdnBaseUrl() })
        }),
        comments: createD1CommentRepository(db),
        legal: createD1LegalPageRepository(db)
    };
}

function d1ServiceStores(backend: D1Backend): ServiceStores {
    const { db, bucket } = backend;
    return {
        ...d1Repositories(backend, { bannerUrls: false }),
        writers: {
            comments: createD1CommentWriter(db),
            views: createD1ViewRecorder(db),
            subscribers: createD1SubscriberRepository(db),
            newsletter: createD1NewsletterStore(db),
            feedback: createD1FeedbackRecorder(db),
            notifications: createD1AdminNotifier(db)
        },
        identity: createD1IdentityVersionReader(db),
        ard: createD1ArdIndexStore(db),
        lockout: createD1LoginLockoutStore(db),
        maintenance: createD1MaintenanceStore(db),
        renders: createD1RenderStore(db, bucket),
        activityLog: createD1ActivityLog(db),
        adminActivity: createD1AdminActivityStore(db),
        adminSettings: createD1AdminSettingsStore(db),
        adminAuthor: createD1AdminAuthorStore(db),
        adminPosts: {
            posts: createD1AdminPostStore(db, bucket),
            operations: createD1PostOperationStore(db, bucket),
            cleanup: createD1PostCleanupStore(db, bucket)
        },
        cvDocuments: createD1CvDocumentStore(db),
        openPgpKeys: createD1OpenPgpKeyStore(db),
        siteData: createD1SiteDataStore(db, bucket),
        authorWriter: createD1AuthorWriter(db),
        legalWriter: createD1LegalPageWriter(db),
        oidcClients: createD1OidcClientStore(db),
        oidcAuth: createD1OidcAuthStore(db)
    };
}

function cacheEnabled(platform: unknown) {
    const configured =
        (platform as PlatformEnv)?.env?.DATA_CACHE
        ?? (privateEnv as Record<string, string | undefined>).DATA_CACHE
        ?? process.env.DATA_CACHE;
    return ['1', 'true'].includes(
        String(configured ?? '')
            .trim()
            .toLowerCase()
    );
}

function cachedPublic(platform: unknown, backend: D1Backend, repos: Repositories): Repositories {
    const cache = cacheEnabled(platform) ? workersResultCache() : null;
    if (!cache) return repos;
    const version = binding<{ id?: string }>(platform, 'CF_VERSION_METADATA');
    return cachedRepositories(repos, {
        generations: createD1CacheGenerations(backend.db),
        cache,
        namespace: async () => (await version().catch(() => null))?.id ?? 'unversioned'
    });
}

export function dataStores(platform?: unknown, options: DataStoreOptions = {}): DataStores {
    const backend: D1Backend = {
        db: lazyD1(binding<D1Like>(platform, 'DB')),
        bucket: lazyBucket(binding<ContentBucket>(platform, 'ASSET_BUCKET'))
    };
    let publicStores: PublicStores | undefined;
    let serviceStores: ServiceStores | undefined;
    return {
        get public() {
            return (publicStores ??= {
                ...cachedPublic(platform, backend, d1Repositories(backend, options)),
                identity: createD1IdentityVersionReader(backend.db)
            });
        },
        get service() {
            return (serviceStores ??= d1ServiceStores(backend));
        }
    };
}
