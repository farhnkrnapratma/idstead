import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    ActivityLogFilter,
    ActivityLogPage,
    AdminSettingsStore,
    AdminReply,
    AdminReplyResult,
    SubscriberStats,
    ActivityEntry,
    ActivityLog,
    AdminActivityStore,
    AdminNotificationKind,
    AdminNotifier,
    FeedbackRecorder,
    FeedbackRecording,
    FeedbackTarget,
    InboxQuery,
    NotificationGroupAction,
    PageFeedback
} from '../activity';
import { DataError } from '../errors';
import { sourceRecord } from '../source';

const NOTIFICATIONS = 'db_admin_notifications';

type RpcResult = { data: unknown; error: { message?: string } | null };

function errorMentions(error: { message?: string } | null, code: string) {
    return typeof error?.message === 'string' && error.message.includes(code);
}

export function createSupabaseFeedbackRecorder(db: SupabaseClient): FeedbackRecorder {
    return {
        async record(target: FeedbackTarget, feedback: PageFeedback): Promise<FeedbackRecording> {
            const { data, error } = (await db.rpc('db_record_page_feedback', {
                p_operation_id: feedback.operationId,
                p_target_type: target.type,
                p_target_id:
                    target.type === 'article' ?
                        sourceRecord(target.post.source).postId
                    :   target.page,
                p_vote: feedback.vote,
                p_ip_hash: feedback.ipHash
            })) as RpcResult;
            if (errorMentions(error, 'FEEDBACK_OPERATION_CONFLICT'))
                return { status: 'operation-conflict' };
            if (errorMentions(error, 'FEEDBACK_TARGET_NOT_FOUND'))
                return { status: 'target-not-found' };
            if (error) throw new DataError('feedback.record', error);
            const result = data as { recorded?: unknown; replayed?: unknown } | null;
            if (typeof result?.recorded !== 'boolean' || typeof result?.replayed !== 'boolean')
                throw new DataError('feedback.record.result');
            return { status: 'saved', recorded: result.recorded, replayed: result.replayed };
        }
    };
}

export function createSupabaseAdminNotifier(db: SupabaseClient): AdminNotifier {
    return {
        async notify(kind: AdminNotificationKind) {
            const { error } = await db.from(NOTIFICATIONS).insert({ kind });
            if (error) throw new DataError('notifications.notify', error);
        }
    };
}

export function createSupabaseActivityLog(db: SupabaseClient): ActivityLog {
    return {
        async append(entry: ActivityEntry) {
            const { error } = await db
                .from('db_activity_log')
                .insert({
                    actor: entry.actor,
                    action: entry.action,
                    category: entry.category,
                    entity_id: entry.entityId,
                    summary: entry.summary,
                    details: entry.details,
                    ip: entry.ip,
                    ip_hash: entry.ipHash,
                    user_agent: entry.userAgent
                });
            if (error) throw new DataError('activity.append', error);
        },

        async list(filter: ActivityLogFilter): Promise<ActivityLogPage> {
            const { data, error } = (await db.rpc('db_activity_log_list', {
                ...filterArgs(filter),
                p_limit: filter.limit,
                p_offset: filter.offset
            })) as RpcResult;
            if (error) throw new DataError('activity.list', error);
            return activityLogPage(data);
        },

        async export(filter): Promise<ActivityLogPage> {
            const { data, error } = (await db.rpc(
                'db_activity_log_export',
                filterArgs(filter)
            )) as RpcResult;
            if (error) throw new DataError('activity.export', error);
            return activityLogPage(data);
        }
    };
}

function filterArgs(filter: Omit<ActivityLogFilter, 'limit' | 'offset'>) {
    return {
        p_category: filter.category,
        p_from: filter.from,
        p_to: filter.to,
        p_query: filter.query,
        p_direction: filter.direction,
        p_sort: filter.sort
    };
}

function activityLogPage(data: unknown): ActivityLogPage {
    const page = data as { data?: unknown[]; total?: unknown } | null;
    return { data: page?.data ?? [], total: Number(page?.total ?? 0) };
}

export function createSupabaseAdminActivityStore(db: SupabaseClient): AdminActivityStore {
    async function call(name: string, args?: Record<string, unknown>) {
        const { data, error } = (await (args ? db.rpc(name, args) : db.rpc(name))) as RpcResult;
        if (error) throw new DataError(`activity.${name}`, error);
        return data;
    }

    async function count(operation: string, query: PromiseLike<RpcResult>) {
        const { data, error } = await query;
        if (error) throw new DataError(operation, error);
        return Array.isArray(data) ? data.length : 0;
    }

    return {
        dashboard: () => call('db_admin_dashboard'),

        feedbackGroups: ({ offset, page }) =>
            call('db_admin_feedback_groups', {
                p_offset: offset,
                p_target_type: page?.type ?? null,
                p_target_id: page?.id ?? null
            }),

        feedbackHistory: ({ offset, page, focusId }) =>
            call('db_admin_feedback_history', {
                p_offset: offset,
                p_target_type: page.type,
                p_target_id: page.id,
                p_focus_id: focusId
            }),

        reportGroups: ({ offset, postId, focusId }) =>
            call('db_admin_report_groups', {
                p_offset: offset,
                p_post_id: postId,
                p_focus_id: focusId
            }),

        reportHistory: ({ commentId, reason, offset, focusId }) =>
            call('db_admin_report_history', {
                p_comment_id: commentId,
                p_reason: reason,
                p_offset: offset,
                p_focus_id: focusId
            }),

        inbox: (query: InboxQuery) =>
            call('db_admin_inbox', {
                p_query: query.query,
                p_type: query.type,
                p_read: query.read,
                p_sort: query.sort,
                p_direction: query.direction,
                p_cursor: query.cursor
            }),

        markRead: (id: string) =>
            count(
                'notifications.markRead',
                db
                    .from(NOTIFICATIONS)
                    .update({ read_at: new Date().toISOString() })
                    .eq('id', id)
                    .is('read_at', null)
                    .select('id')
            ),

        markAllRead: () => {
            const now = new Date().toISOString();
            return count(
                'notifications.markAllRead',
                db
                    .from(NOTIFICATIONS)
                    .update({ read_at: now })
                    .is('read_at', null)
                    .lte('created_at', now)
                    .select('id')
            );
        },

        remove: (id: string) =>
            count(
                'notifications.remove',
                db.from(NOTIFICATIONS).delete().eq('id', id).select('id')
            ),

        setPinned: (id: string, pinned: boolean) =>
            count(
                'notifications.setPinned',
                db
                    .from(NOTIFICATIONS)
                    .update({ pinned_at: pinned ? new Date().toISOString() : null })
                    .eq('id', id)
                    .select('id')
            ),

        async clearNotifications({ actorId, operationId, confirm }) {
            const { data, error } = (await db.rpc('db_admin_clear_notifications', {
                p_actor_id: actorId,
                p_operation_id: operationId,
                p_confirm: confirm
            })) as RpcResult;
            if (
                errorMentions(error, 'CLEAR_OPERATION_CONFLICT')
                || errorMentions(error, 'CLEAR_NOT_PREPARED')
            )
                return { status: 'conflict' };
            if (error) throw new DataError('notifications.clear', error);
            return { status: 'done', result: data };
        },

        workspace: (section: string, options: Record<string, unknown>) =>
            call('db_admin_workspace', { p_section: section, p_options: options }),

        notificationGroupAction: (action: NotificationGroupAction) =>
            call('db_admin_notification_group_action', {
                p_id: action.id,
                p_as_of: action.asOf,
                p_tz: action.timeZone,
                p_delete: action.remove,
                p_from: action.from ?? '-infinity',
                p_to: action.to ?? 'infinity'
            }),

        deleteComment: (id: string) => call('db_admin_delete_comment', { p_id: id }),

        async replyToComment(reply: AdminReply): Promise<AdminReplyResult> {
            const { data: parent, error: parentError } = await db
                .from('db_comments')
                .select('id')
                .eq('id', reply.parentId)
                .eq('post_id', reply.postId)
                .maybeSingle();
            if (parentError) throw new DataError('activity.replyToComment.parent', parentError);
            if (!parent) return { status: 'invalid-parent' };
            const { data, error } = await db
                .from('db_comments')
                .insert({
                    post_id: reply.postId,
                    parent_id: reply.parentId,
                    author_name: reply.authorName,
                    content: reply.content,
                    is_anonymous: false,
                    is_admin: true,
                    is_approved: true
                })
                .select(
                    'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
                )
                .single();
            if (error || !data) throw new DataError('activity.replyToComment', error);
            return { status: 'created', comment: data as Record<string, unknown> };
        },

        async dismissReports(commentId: string) {
            const { error } = await db
                .from('db_comment_reports')
                .delete()
                .eq('comment_id', commentId);
            if (error) throw new DataError('activity.dismissReports', error);
        },

        async subscriberStats(): Promise<SubscriberStats> {
            const stats = (await call('db_subscriber_stats')) as Partial<SubscriberStats> | null;
            return {
                active: Number(stats?.active ?? 0),
                pending: Number(stats?.pending ?? 0),
                unsubscribed: Number(stats?.unsubscribed ?? 0)
            };
        }
    };
}

export function createSupabaseAdminSettingsStore(db: SupabaseClient): AdminSettingsStore {
    return {
        async read(userId: string) {
            const { data, error } = await db
                .from('db_admin_settings')
                .select('settings')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) throw new DataError('adminSettings.read', error);
            return data?.settings ?? null;
        },

        async write(userId: string, settings: unknown) {
            const { error } = await db
                .from('db_admin_settings')
                .upsert(
                    { user_id: userId, settings, updated_at: new Date().toISOString() },
                    { onConflict: 'user_id' }
                );
            if (error) throw new DataError('adminSettings.write', error);
        }
    };
}
