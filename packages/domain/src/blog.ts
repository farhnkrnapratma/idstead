// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface PublicPostFields {
    id: string;
    title: string;
    slug: string;
    pinned: boolean;
    created_at: string;
    updated_at: string | null;
    excerpt: string | null;
    tags: string[];
    collaborators: string[];
}

export interface PostStats {
    comment_count: number;
    views_count: number;
}

export interface PublicComment {
    id: string;
    parent_id: string | null;
    author_name: string | null;
    content: string;
    is_anonymous: boolean;
    is_admin: boolean;
    created_at: string;
}

export interface RecentComment {
    post: { id: string; slug: string };
    author_name: string | null;
    content: string;
    is_anonymous: boolean;
    is_admin: boolean;
    is_reply: boolean;
    created_at: string;
}

export function publicCommentAuthor(comment: {
    author_name: string | null;
    is_anonymous: boolean;
}) {
    return comment.is_anonymous ? 'Anonymous' : comment.author_name;
}

export function publicPostFields(post: PublicPostFields): PublicPostFields {
    return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        pinned: post.pinned,
        created_at: post.created_at,
        updated_at: post.updated_at,
        excerpt: post.excerpt,
        tags: post.tags,
        collaborators: post.collaborators
    };
}
