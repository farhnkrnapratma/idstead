import type { SupabaseClient } from '@supabase/supabase-js';
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
export type { SupabaseRepositoryOptions };

export interface Repositories {
    author: AuthorRepository;
    blog: BlogRepository;
    comments: CommentRepository;
}

export function createSupabaseRepositories(
    db: SupabaseClient,
    options: SupabaseRepositoryOptions = {}
): Repositories {
    return {
        author: createSupabaseAuthorRepository(db, options),
        blog: createSupabaseBlogRepository(db, options),
        comments: createSupabaseCommentRepository(db)
    };
}

export interface Writers {
    comments: CommentWriter;
    views: ViewRecorder;
    subscribers: SubscriberRepository;
    newsletter: NewsletterStore;
}

export function createSupabaseWriters(db: SupabaseClient): Writers {
    return {
        comments: createSupabaseCommentWriter(db),
        views: createSupabaseViewRecorder(db),
        subscribers: createSupabaseSubscriberRepository(db),
        newsletter: createSupabaseNewsletterStore(db)
    };
}
