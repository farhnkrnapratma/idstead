import type { AdminNotifier, FeedbackRecorder } from './activity';
import type { AdminPostStore, PostCleanupStore, PostOperationStore } from './adminPosts';
import type { LegalPageRepository } from './legal';
import type { AuthorRepository } from './author';
import type { BlogRepository, CommentRepository, CommentWriter, ViewRecorder } from './blog';
import type { NewsletterStore, SubscriberRepository } from './subscribers';

export type * from './activity';
export type * from './adminAuthor';
export type * from './ard';
export type * from './identity';
export type * from './lockout';
export type * from './maintenance';
export type * from './adminPosts';
export type * from './cvDocuments';
export type * from './legal';
export type * from './siteData';
export type * from './author';
export type * from './blog';
export type * from './subscribers';
export { DataError } from './errors';
export { postRenderPath } from './paths';
export { publicProfile } from './authorReader';
export type { ContentBucket, D1Like } from './d1/client';
export { createD1BlogRepository, createD1CommentRepository, createD1RenderStore } from './d1/blog';
export { createD1CommentWriter, createD1ViewRecorder } from './d1/writes';
export { createD1AuthorRepository } from './d1/author';
export { createD1AdminAuthorStore, createD1AuthorWriter } from './d1/adminAuthor';
export { createD1CvDocumentStore, createD1OpenPgpKeyStore } from './d1/cvDocuments';
export { createD1SiteDataStore } from './d1/siteData';
export { createD1NewsletterStore, createD1SubscriberRepository } from './d1/subscribers';
export {
    createD1ActivityLog,
    createD1AdminNotifier,
    createD1AdminSettingsStore,
    createD1FeedbackRecorder
} from './d1/activity';
export { createD1AdminActivityStore } from './d1/adminActivity';
export {
    createD1AdminPostStore,
    createD1PostCleanupStore,
    createD1PostOperationStore
} from './d1/adminPosts';
export { createD1LegalPageRepository, createD1LegalPageWriter } from './d1/legal';
export {
    createD1ArdIndexStore,
    createD1IdentityVersionReader,
    createD1LoginLockoutStore,
    createD1MaintenanceStore
} from './d1/support';

export interface Repositories {
    author: AuthorRepository;
    blog: BlogRepository;
    comments: CommentRepository;
    legal: LegalPageRepository;
}

export interface Writers {
    comments: CommentWriter;
    views: ViewRecorder;
    subscribers: SubscriberRepository;
    newsletter: NewsletterStore;
    feedback: FeedbackRecorder;
    notifications: AdminNotifier;
}

export interface AdminPostStores {
    posts: AdminPostStore;
    operations: PostOperationStore;
    cleanup: PostCleanupStore;
}

export {
    CACHE_TTL_SECONDS,
    RENDER_TTL_SECONDS,
    STATS_TTL_SECONDS,
    cachedRepositories,
    createD1CacheGenerations,
    memoryResultCache,
    type CacheGenerations,
    type ResultCache
} from './cache';
