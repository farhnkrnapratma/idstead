import { describe, expect, test } from 'bun:test';
import { createSupabaseBlogRepository } from '../packages/data/src/supabase/blog.ts';
import {
    createSupabaseActivityLog,
    createSupabaseAdminActivityStore,
    createSupabaseAdminNotifier,
    createSupabaseFeedbackRecorder
} from '../packages/data/src/supabase/activity.ts';
import { DataError } from '../packages/data/src/errors.ts';
import { activityContract, type ActivitySeed } from './contracts/activity.contract.ts';
import { fakeSupabase, type Row } from './support/fakeSupabase.ts';

function supabaseFromSeed(
    seed: ActivitySeed,
    rpc: NonNullable<Parameters<typeof fakeSupabase>[2]>['rpc'] = {}
) {
    let sequence = 0;
    const { db, fetch } = fakeSupabase(
        {
            db_posts: seed.posts.map(post => ({
                id: post.uuid,
                public_id: post.publicId,
                slug: post.slug,
                title: post.slug,
                excerpt: null,
                published: true,
                pinned: false,
                created_at: '2026-10-01T00:00:00Z',
                tags: [],
                storage_path: null,
                view_count: 0
            })),
            db_admin_notifications: seed.notifications.map(item => ({
                id: item.id,
                kind: item.kind,
                created_at: item.createdAt,
                read_at: item.read ? item.createdAt : null,
                pinned_at: null
            })),
            db_activity_log: [],
            feedback_operations: []
        },
        {},
        {
            defaults: {
                db_admin_notifications: () => ({
                    id: `notification-${++sequence}`,
                    created_at: '2026-10-04T00:00:00Z',
                    read_at: null,
                    pinned_at: null
                })
            },
            rpc: {
                db_record_page_feedback: (args, tables) => {
                    const known =
                        args.p_target_type === 'article' ?
                            tables.db_posts.some(post => post.id === args.p_target_id)
                        :   seed.legalPages.includes(String(args.p_target_id));
                    if (!known)
                        return { data: null, error: { message: 'FEEDBACK_TARGET_NOT_FOUND' } };
                    const payload = JSON.stringify([
                        args.p_target_type,
                        args.p_target_id,
                        args.p_vote,
                        args.p_ip_hash
                    ]);
                    const existing = tables.feedback_operations.find(
                        op => op.id === args.p_operation_id
                    );
                    if (existing)
                        return existing.payload === payload ?
                                { data: { recorded: true, replayed: true }, error: null }
                            :   { data: null, error: { message: 'FEEDBACK_OPERATION_CONFLICT' } };
                    tables.feedback_operations.push({ id: args.p_operation_id, payload });
                    return { data: { recorded: true, replayed: false }, error: null };
                },
                ...rpc
            }
        }
    );
    return {
        db,
        blog: createSupabaseBlogRepository(db, { fetch, cdnBase: 'https://cdn.test' }),
        feedback: createSupabaseFeedbackRecorder(db),
        notifier: createSupabaseAdminNotifier(db),
        activity: createSupabaseAdminActivityStore(db)
    };
}

activityContract('Supabase adapter', supabaseFromSeed);

const empty: ActivitySeed = { posts: [], legalPages: [], notifications: [] };
const echo = (name: string) => (args: Row) => ({ data: { name, args }, error: null });

describe('Supabase activity adapter', () => {
    test('passes analytics queries to the matching database functions', async () => {
        const names = [
            'db_admin_dashboard',
            'db_admin_feedback_groups',
            'db_admin_feedback_history',
            'db_admin_report_groups',
            'db_admin_report_history',
            'db_admin_inbox',
            'db_admin_workspace',
            'db_admin_notification_group_action',
            'db_admin_delete_comment'
        ];
        const { activity } = supabaseFromSeed(
            empty,
            Object.fromEntries(names.map(name => [name, echo(name)]))
        );
        const page = { type: 'legal' as const, id: 'terms' };
        expect(await activity.dashboard()).toEqual({ name: 'db_admin_dashboard', args: {} });
        expect(await activity.feedbackGroups({ offset: 20, page: null })).toEqual({
            name: 'db_admin_feedback_groups',
            args: { p_offset: 20, p_target_type: null, p_target_id: null }
        });
        expect(await activity.feedbackHistory({ offset: 0, page, focusId: 'f' })).toEqual({
            name: 'db_admin_feedback_history',
            args: { p_offset: 0, p_target_type: 'legal', p_target_id: 'terms', p_focus_id: 'f' }
        });
        expect(await activity.reportGroups({ offset: 0, postId: 'p', focusId: null })).toEqual({
            name: 'db_admin_report_groups',
            args: { p_offset: 0, p_post_id: 'p', p_focus_id: null }
        });
        expect(
            await activity.reportHistory({ commentId: 'c', reason: null, offset: 5, focusId: null })
        ).toEqual({
            name: 'db_admin_report_history',
            args: { p_comment_id: 'c', p_reason: null, p_offset: 5, p_focus_id: null }
        });
        expect(
            await activity.inbox({
                query: 'q',
                type: 'all',
                read: 'unread',
                sort: 'date',
                direction: 'desc',
                cursor: null
            })
        ).toEqual({
            name: 'db_admin_inbox',
            args: {
                p_query: 'q',
                p_type: 'all',
                p_read: 'unread',
                p_sort: 'date',
                p_direction: 'desc',
                p_cursor: null
            }
        });
        expect(await activity.workspace('summary', { range: 'all' })).toEqual({
            name: 'db_admin_workspace',
            args: { p_section: 'summary', p_options: { range: 'all' } }
        });
        expect(
            await activity.notificationGroupAction({
                id: 'g',
                asOf: '2026-10-01T00:00:00.000Z',
                timeZone: 'UTC',
                remove: true,
                from: null,
                to: null
            })
        ).toEqual({
            name: 'db_admin_notification_group_action',
            args: {
                p_id: 'g',
                p_as_of: '2026-10-01T00:00:00.000Z',
                p_tz: 'UTC',
                p_delete: true,
                p_from: '-infinity',
                p_to: 'infinity'
            }
        });
        expect(await activity.deleteComment('c')).toEqual({
            name: 'db_admin_delete_comment',
            args: { p_id: 'c' }
        });
    });

    test('turns clear conflicts into a status and other errors into DataError', async () => {
        let mode = 'ok';
        const { activity } = supabaseFromSeed(empty, {
            db_admin_clear_notifications: args =>
                mode === 'ok' ? { data: { cleared: 3, confirm: args.p_confirm }, error: null }
                : mode === 'conflict' ? { data: null, error: { message: 'CLEAR_NOT_PREPARED' } }
                : { data: null, error: { message: 'boom' } }
        });
        const input = { actorId: 'a', operationId: 'o', confirm: true };
        expect(await activity.clearNotifications(input)).toEqual({
            status: 'done',
            result: { cleared: 3, confirm: true }
        });
        mode = 'conflict';
        expect(await activity.clearNotifications(input)).toEqual({ status: 'conflict' });
        mode = 'error';
        await expect(activity.clearNotifications(input)).rejects.toBeInstanceOf(DataError);
    });

    test('rejects feedback results it cannot confirm', async () => {
        const { feedback } = supabaseFromSeed(empty, {
            db_record_page_feedback: () => ({ data: { recorded: 'yes' }, error: null })
        });
        await expect(
            feedback.record(
                { type: 'legal', page: 'terms' },
                { operationId: 'o', vote: 'yes', ipHash: 'h' }
            )
        ).rejects.toBeInstanceOf(DataError);
    });

    test('appends activity entries with their column names', async () => {
        const { db } = supabaseFromSeed(empty);
        await createSupabaseActivityLog(db).append({
            actor: 'admin',
            action: 'blog.publish',
            category: 'blog',
            entityId: 'post',
            summary: 'Published',
            details: { a: 1 },
            ip: null,
            ipHash: 'h',
            userAgent: 'ua'
        });
        const { data } = await db.from('db_activity_log').select('*');
        expect(data).toEqual([
            {
                actor: 'admin',
                action: 'blog.publish',
                category: 'blog',
                entity_id: 'post',
                summary: 'Published',
                details: { a: 1 },
                ip: null,
                ip_hash: 'h',
                user_agent: 'ua'
            }
        ]);
    });
});
