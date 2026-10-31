// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { publicCommentAuthor } from '@idstead/domain/blog.ts';
import type {
    CommentCreation,
    CommentReport,
    CommentWriter,
    NewComment,
    PublishedPost,
    ViewRecorder,
    ViewRecording
} from '../blog';
import { DataError } from '../errors';
import { sourceRecord } from '../source';
import { flag, type D1Like } from './client';

export function createD1CommentWriter(db: D1Like): CommentWriter {
    return {
        async create(post: PublishedPost, comment: NewComment): Promise<CommentCreation> {
            const { postId } = sourceRecord(post.source);
            try {
                let parentUuid: string | null = null;
                if (comment.parentId) {
                    const parent = await db
                        .prepare(
                            'SELECT id FROM db_comments WHERE public_id = ?1 AND post_id = ?2 AND is_approved = 1'
                        )
                        .bind(comment.parentId, postId)
                        .first<{ id: string }>();
                    if (!parent) return { status: 'invalid-parent' };
                    parentUuid = parent.id;
                }
                const row = await db
                    .prepare(
                        `INSERT INTO db_comments (post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved)
                         VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)
                         RETURNING public_id, author_name, content, is_anonymous, is_admin, is_approved, created_at`
                    )
                    .bind(
                        postId,
                        parentUuid,
                        comment.authorName,
                        comment.content,
                        comment.approved ? 1 : 0
                    )
                    .first();
                if (!row) throw new Error('The comment was not stored.');
                const isAnonymous = flag(row.is_anonymous);
                return {
                    status: 'created',
                    comment: {
                        id: String(row.public_id),
                        parent_id: comment.parentId,
                        author_name: publicCommentAuthor({
                            author_name:
                                typeof row.author_name === 'string' ? row.author_name : null,
                            is_anonymous: isAnonymous
                        }),
                        content: String(row.content ?? ''),
                        is_anonymous: isAnonymous,
                        is_admin: flag(row.is_admin),
                        is_approved: flag(row.is_approved),
                        created_at: String(row.created_at ?? '')
                    }
                };
            } catch (error) {
                throw new DataError('comments.create', error);
            }
        },

        async report(commentId: string, report: CommentReport) {
            try {
                const { meta } = await db
                    .prepare(
                        `INSERT INTO db_comment_reports (comment_id, reason, details, reporter_ip_hash)
                         SELECT id, ?2, ?3, ?4 FROM db_comments WHERE public_id = ?1`
                    )
                    .bind(commentId, report.reason, report.details, report.reporterIpHash)
                    .run();
                return meta.changes > 0 ? 'reported' : 'not-found';
            } catch (error) {
                throw new DataError('comments.report', error);
            }
        }
    };
}

export function createD1ViewRecorder(db: D1Like): ViewRecorder {
    return {
        async record(post: PublishedPost, visitorKey: string): Promise<ViewRecording> {
            const { postId } = sourceRecord(post.source);
            try {
                const [inserted, counter] = await db.batch([
                    db
                        .prepare(
                            `INSERT INTO db_views (post_id, ip_hash, viewed_at) VALUES (?1, ?2, ?3)
                             ON CONFLICT (post_id, ip_hash) DO NOTHING RETURNING id`
                        )
                        .bind(postId, visitorKey, new Date().toISOString()),
                    db
                        .prepare('SELECT view_count FROM db_post_stats WHERE post_id = ?1')
                        .bind(postId)
                ]);
                return {
                    counted: inserted.results.length > 0,
                    views: Number(counter.results[0]?.view_count ?? 0)
                };
            } catch (error) {
                throw new DataError('views.record', error);
            }
        }
    };
}
