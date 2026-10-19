import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthorRepository } from './author';
import type { BlogRepository, CommentRepository } from './blog';
import { createSupabaseAuthorRepository, publicProfile } from './supabase/author';
import {
    createSupabaseBlogRepository,
    createSupabaseCommentRepository,
    type SupabaseRepositoryOptions
} from './supabase/blog';

export type * from './author';
export type * from './blog';
export { DataError } from './errors';
export { postRenderPath } from './supabase/paths';
export { createSupabaseRenderStore } from './supabase/renders';
export { createSupabaseBlogRepository, createSupabaseCommentRepository };
export { createSupabaseAuthorRepository, publicProfile };
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
