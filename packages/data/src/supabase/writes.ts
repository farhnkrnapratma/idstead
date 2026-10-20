import type { SupabaseClient } from '@supabase/supabase-js';
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

export function createSupabaseCommentWriter(db: SupabaseClient): CommentWriter {
    return {
        async create(post: PublishedPost, comment: NewComment): Promise<CommentCreation> {
            const { postId } = sourceRecord(post.source);
            let parentUuid: string | null = null;
            if (comment.parentId) {
                const { data: parent, error } = await db
                    .from('db_comments')
                    .select('id')
                    .eq('public_id', comment.parentId)
                    .eq('post_id', postId)
                    .eq('is_approved', true)
                    .maybeSingle();
                if (error) throw new DataError('comments.create.parent', error);
                if (!parent) return { status: 'invalid-parent' };
                parentUuid = (parent as { id: string }).id;
            }
            const { data, error } = await db
                .from('db_comments')
                .insert({
                    post_id: postId,
                    parent_id: parentUuid,
                    author_name: comment.authorName,
                    content: comment.content,
                    is_anonymous: false,
                    is_admin: false,
                    is_approved: comment.approved
                })
                .select(
                    'public_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
                )
                .single();
            if (error || !data) throw new DataError('comments.create', error);
            const row = data as Record<string, unknown>;
            const isAnonymous = row.is_anonymous === true;
            return {
                status: 'created',
                comment: {
                    id: String(row.public_id),
                    parent_id: comment.parentId,
                    author_name: publicCommentAuthor({
                        author_name: typeof row.author_name === 'string' ? row.author_name : null,
                        is_anonymous: isAnonymous
                    }),
                    content: String(row.content ?? ''),
                    is_anonymous: isAnonymous,
                    is_admin: row.is_admin === true,
                    is_approved: row.is_approved === true,
                    created_at: String(row.created_at ?? '')
                }
            };
        },

        async report(commentId: string, report: CommentReport) {
            const { data: target, error } = await db
                .from('db_comments')
                .select('id')
                .eq('public_id', commentId)
                .maybeSingle();
            if (error) throw new DataError('comments.report.lookup', error);
            if (!target) return 'not-found';
            const { error: insertError } = await db
                .from('db_comment_reports')
                .insert({
                    comment_id: (target as { id: string }).id,
                    reason: report.reason,
                    details: report.details,
                    reporter_ip_hash: report.reporterIpHash
                });
            if (insertError) throw new DataError('comments.report', insertError);
            return 'reported';
        }
    };
}

export function createSupabaseViewRecorder(db: SupabaseClient): ViewRecorder {
    return {
        async record(post: PublishedPost, visitorKey: string): Promise<ViewRecording> {
            const { postId } = sourceRecord(post.source);
            const { data: inserted, error } = await db
                .from('db_views')
                .upsert(
                    { post_id: postId, ip_hash: visitorKey, viewed_at: new Date().toISOString() },
                    { onConflict: 'post_id,ip_hash', ignoreDuplicates: true }
                )
                .select('id');
            if (error) throw new DataError('views.record', error);
            const { data: counter, error: countError } = await db
                .from('db_posts')
                .select('view_count')
                .eq('id', postId)
                .maybeSingle();
            if (countError) throw new DataError('views.count', countError);
            return {
                counted: ((inserted ?? []) as unknown[]).length > 0,
                views: (counter as { view_count?: number } | null)?.view_count ?? 0
            };
        }
    };
}
