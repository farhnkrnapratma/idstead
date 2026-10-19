import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlogRepository, CommentRepository } from './blog';
import {
    createSupabaseBlogRepository,
    createSupabaseCommentRepository,
    type SupabaseRepositoryOptions
} from './supabase/blog';

export type * from './blog';
export { DataError } from './errors';
export { postRenderPath } from './supabase/paths';
export { createSupabaseRenderStore } from './supabase/renders';
export { createSupabaseBlogRepository, createSupabaseCommentRepository };
export type { SupabaseRepositoryOptions };

export interface Repositories {
    blog: BlogRepository;
    comments: CommentRepository;
}

export function createSupabaseRepositories(
    db: SupabaseClient,
    options: SupabaseRepositoryOptions = {}
): Repositories {
    return {
        blog: createSupabaseBlogRepository(db, options),
        comments: createSupabaseCommentRepository(db)
    };
}
