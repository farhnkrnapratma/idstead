import type { SupabaseClient } from '@supabase/supabase-js';
import type {
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
        }
    };
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

        deleteComment: (id: string) => call('db_admin_delete_comment', { p_id: id })
    };
}
