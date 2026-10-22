import {
    createSupabaseBlogRepository,
    createSupabaseCommentRepository
} from '../packages/data/src/supabase/blog.ts';
import {
    createSupabaseCommentWriter,
    createSupabaseViewRecorder
} from '../packages/data/src/supabase/writes.ts';
import { blogRepositoryContract, type ContractSeed } from './contracts/blogRepository.contract.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';
import { createD1BlogRepository, createD1CommentRepository } from '../packages/data/src/d1/blog.ts';
import { createD1CommentWriter, createD1ViewRecorder } from '../packages/data/src/d1/writes.ts';
import { insertRows, d1Shim, memoryBucket } from './support/d1.ts';

function supabaseFromSeed(seed: ContractSeed) {
    const files: Record<string, string> = {};
    const db_posts = seed.posts.map(post => {
        const storagePath =
            post.markdown || post.render ?
                `posts/${post.uuid}/${post.uuid.replace(/^0/, 'f')}.md`
            :   null;
        if (storagePath && post.markdown) files[storagePath] = post.markdown;
        if (storagePath && post.render)
            files[storagePath.replace(/\.md$/, '.render.json')] = post.render;
        return {
            id: post.uuid,
            public_id: post.publicId,
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt ?? null,
            published: post.published,
            pinned: post.pinned ?? false,
            created_at: post.createdAt,
            updated_at: null,
            tags: post.tags ?? [],
            collaborators: [],
            summary: null,
            tldr: [],
            storage_path: storagePath,
            banner_version: null,
            read_time: post.readMinutes ?? null,
            view_count: seed.views.filter(view => view.postUuid === post.uuid).length
        };
    });
    const db_comments = seed.comments.map(comment => ({
        id: comment.uuid,
        public_id: comment.publicId,
        post_id: comment.postUuid,
        parent_id: comment.parentUuid ?? null,
        author_name: comment.author,
        content: 'Hello',
        is_anonymous: comment.anonymous ?? false,
        is_admin: false,
        is_approved: comment.approved,
        created_at: comment.createdAt
    }));
    const db_views = seed.views.map((view, i) => ({ id: `view-${i}`, post_id: view.postUuid }));
    let sequence = 0;
    const uuid = () => `00000000-0000-4000-9000-${String(++sequence).padStart(12, '0')}`;
    const { db, fetch } = fakeSupabase(
        { db_posts, db_comments, db_views, db_comment_reports: [] },
        files,
        {
            defaults: {
                db_comments: () => ({
                    id: uuid(),
                    public_id: (sequence + 1).toString(16).padStart(64, 'f'),
                    created_at: '2026-10-07T00:00:00Z'
                }),
                db_views: () => ({ id: uuid() }),
                db_comment_reports: () => ({ id: uuid() })
            },
            afterInsert: (table, row, tables) => {
                if (table !== 'db_views') return;
                const post = tables.db_posts.find(item => item.id === row.post_id);
                if (post) post.view_count = Number(post.view_count ?? 0) + 1;
            }
        }
    );
    return {
        blog: createSupabaseBlogRepository(db, { fetch, cdnBase: 'https://cdn.test' }),
        comments: createSupabaseCommentRepository(db),
        writers: {
            comments: createSupabaseCommentWriter(db),
            views: createSupabaseViewRecorder(db)
        }
    };
}

blogRepositoryContract('Supabase adapter', supabaseFromSeed);

function d1FromSeed(seed: ContractSeed) {
    const { db, sqlite } = d1Shim();
    const bucket = memoryBucket();
    insertRows(
        sqlite,
        'db_posts',
        seed.posts.map(post => {
            const storagePath =
                post.markdown || post.render ?
                    `posts/${post.uuid}/${post.uuid.replace(/^0/, 'f')}.md`
                :   `posts/${post.uuid}/missing.md`;
            if (post.markdown) bucket.objects[`content/${storagePath}`] = post.markdown;
            if (post.render)
                bucket.objects[`content/${storagePath.replace(/\.md$/, '.render.json')}`] =
                    post.render;
            return {
                id: post.uuid,
                public_id: post.publicId,
                slug: post.slug,
                title: post.title,
                excerpt: post.excerpt ?? (post.published ? 'Excerpt' : null),
                published: post.published,
                pinned: post.pinned ?? false,
                created_at: post.createdAt,
                tags: JSON.stringify(post.tags ?? []),
                storage_path: storagePath,
                read_time: post.readMinutes ?? null
            };
        })
    );
    insertRows(
        sqlite,
        'db_comments',
        seed.comments.map(comment => ({
            id: comment.uuid,
            public_id: comment.publicId,
            post_id: comment.postUuid,
            parent_id: comment.parentUuid ?? null,
            author_name: comment.author,
            content: 'Hello',
            is_anonymous: comment.anonymous ?? false,
            is_admin: false,
            is_approved: comment.approved,
            created_at: comment.createdAt
        }))
    );
    insertRows(
        sqlite,
        'db_views',
        seed.views.map((view, i) => ({ post_id: view.postUuid, ip_hash: `seed-${i}` }))
    );
    return {
        blog: createD1BlogRepository(db, bucket, { cdnBase: 'https://cdn.test' }),
        comments: createD1CommentRepository(db),
        writers: { comments: createD1CommentWriter(db), views: createD1ViewRecorder(db) }
    };
}

blogRepositoryContract('D1 adapter', d1FromSeed);
