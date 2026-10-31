// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { blogRepositoryContract, type ContractSeed } from './contracts/blogRepository.contract.ts';
import { createD1BlogRepository, createD1CommentRepository } from '../packages/data/src/d1/blog.ts';
import { createD1CommentWriter, createD1ViewRecorder } from '../packages/data/src/d1/writes.ts';
import { insertRows, d1Shim, memoryBucket } from './support/d1.ts';

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
