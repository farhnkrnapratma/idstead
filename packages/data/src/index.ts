import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminNotifier, FeedbackRecorder } from './activity';
import {
    createSupabaseActivityLog,
    createSupabaseAdminActivityStore,
    createSupabaseAdminNotifier,
    createSupabaseAdminSettingsStore,
    createSupabaseFeedbackRecorder
} from './supabase/activity';
import type { AdminPostStore, PostCleanupStore, PostOperationStore } from './adminPosts';
import {
    createSupabaseAdminPostStore,
    createSupabasePostCleanupStore,
    createSupabasePostOperationStore
} from './supabase/adminPosts';
import { createSupabaseAdminAuthorStore, createSupabaseAuthorWriter } from './supabase/adminAuthor';
import {
    createSupabaseCvDocumentStore,
    createSupabaseOpenPgpKeyStore
} from './supabase/cvDocuments';
import { createSupabaseLegalPageRepository, createSupabaseLegalPageWriter } from './supabase/legal';
import type { LegalPageRepository } from './legal';
import { createSupabaseSiteDataStore } from './supabase/siteData';
import type { AuthorRepository } from './author';
import type { BlogRepository, CommentRepository, CommentWriter, ViewRecorder } from './blog';
import { createSupabaseAuthorRepository, publicProfile } from './supabase/author';
import type { NewsletterStore, SubscriberRepository } from './subscribers';
import {
    createSupabaseNewsletterStore,
    createSupabaseSubscriberRepository
} from './supabase/subscribers';
import { createSupabaseCommentWriter, createSupabaseViewRecorder } from './supabase/writes';
import {
    createSupabaseBlogRepository,
    createSupabaseCommentRepository,
    type SupabaseRepositoryOptions
} from './supabase/blog';

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
export { postRenderPath } from './supabase/paths';
export { createSupabaseRenderStore } from './supabase/renders';
export { createSupabaseBlogRepository, createSupabaseCommentRepository };
export { createSupabaseAuthorRepository, publicProfile };
export { createSupabaseCommentWriter, createSupabaseViewRecorder };
export { createSupabaseNewsletterStore, createSupabaseSubscriberRepository };
export {
    createSupabaseActivityLog,
    createSupabaseAdminActivityStore,
    createSupabaseAdminNotifier,
    createSupabaseAdminSettingsStore,
    createSupabaseFeedbackRecorder
};
export { createSupabaseAdminAuthorStore, createSupabaseAuthorWriter };
export { createSupabaseCvDocumentStore, createSupabaseOpenPgpKeyStore };
export { createSupabaseLegalPageRepository, createSupabaseLegalPageWriter };
export { createSupabaseSiteDataStore };
export { createSupabaseArdIndexStore } from './supabase/ard';
export { createSupabaseIdentityVersionReader } from './supabase/identity';
export { createSupabaseLoginLockoutStore } from './supabase/lockout';
export { createSupabaseMaintenanceStore } from './supabase/maintenance';
export type { ContentBucket, D1Like } from './d1/client';
export { createD1BlogRepository, createD1CommentRepository, createD1RenderStore } from './d1/blog';
export { createD1CommentWriter, createD1ViewRecorder } from './d1/writes';
export { createD1AuthorRepository } from './d1/author';
export { createD1NewsletterStore, createD1SubscriberRepository } from './d1/subscribers';
export {
    createD1ActivityLog,
    createD1AdminNotifier,
    createD1AdminSettingsStore,
    createD1FeedbackRecorder
} from './d1/activity';
export { createD1AdminActivityStore } from './d1/adminActivity';
export { createD1LegalPageRepository, createD1LegalPageWriter } from './d1/legal';
export {
    createD1ArdIndexStore,
    createD1IdentityVersionReader,
    createD1LoginLockoutStore,
    createD1MaintenanceStore
} from './d1/support';
export {
    createSupabaseAdminPostStore,
    createSupabasePostCleanupStore,
    createSupabasePostOperationStore
};
export type { SupabaseRepositoryOptions };

export interface Repositories {
    author: AuthorRepository;
    blog: BlogRepository;
    comments: CommentRepository;
    legal: LegalPageRepository;
}

export function createSupabaseRepositories(
    db: SupabaseClient,
    options: SupabaseRepositoryOptions = {}
): Repositories {
    return {
        author: createSupabaseAuthorRepository(db, options),
        blog: createSupabaseBlogRepository(db, options),
        comments: createSupabaseCommentRepository(db),
        legal: createSupabaseLegalPageRepository(db)
    };
}

export interface Writers {
    comments: CommentWriter;
    views: ViewRecorder;
    subscribers: SubscriberRepository;
    newsletter: NewsletterStore;
    feedback: FeedbackRecorder;
    notifications: AdminNotifier;
}

export function createSupabaseWriters(db: SupabaseClient): Writers {
    return {
        comments: createSupabaseCommentWriter(db),
        views: createSupabaseViewRecorder(db),
        subscribers: createSupabaseSubscriberRepository(db),
        newsletter: createSupabaseNewsletterStore(db),
        feedback: createSupabaseFeedbackRecorder(db),
        notifications: createSupabaseAdminNotifier(db)
    };
}

export interface AdminPostStores {
    posts: AdminPostStore;
    operations: PostOperationStore;
    cleanup: PostCleanupStore;
}

export function createSupabaseAdminPostStores(db: SupabaseClient): AdminPostStores {
    return {
        posts: createSupabaseAdminPostStore(db),
        operations: createSupabasePostOperationStore(db),
        cleanup: createSupabasePostCleanupStore(db)
    };
}
