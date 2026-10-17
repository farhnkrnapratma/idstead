import type { SupabaseClient } from '@supabase/supabase-js';
import { blogAdmin } from './blogPostAuth';
import { ActivityInputError, activityJson, activityTarget, activityUuid } from './activityInput';
import { apiError } from './apiError';

function choice(value: string | null, allowed: string[], fallback: string) {
    const selected = value ?? fallback;
    if (!allowed.includes(selected)) throw new ActivityInputError('Invalid activity filter.');
    return selected;
}
function offset(value: string | null) {
    if (value !== null && !/^\d{1,9}$/.test(value)) throw new ActivityInputError('Invalid page.');
    return Number(value ?? 0);
}
function optionalId(value: string | null) {
    return value === null ? null : activityUuid(value);
}

export async function adminActivity(
    input: { request: Request; url: URL; db: SupabaseClient | null },
    inbox: boolean
) {
    const { request, url, db } = input;
    const fail = apiError;
    if (!db)
        return fail(
            503,
            'ADMIN_ACTIVITY_UNAVAILABLE',
            'Admin activity is temporarily unavailable.'
        );
    try {
        const auth = await blogAdmin(request, url, db);
        if (auth.status) return fail(auth.status, 'ADMIN_ACTIVITY_AUTH_REQUIRED', auth.message);
        let result: { data: unknown; error: { message: string } | null };
        if (request.method === 'POST' && inbox) {
            const body = await activityJson(request);
            if (body.action === 'prepare_clear' || body.action === 'clear') {
                result = await db.rpc('db_admin_clear_notifications', {
                    p_actor_id: auth.actor,
                    p_operation_id: activityUuid(body.operationId),
                    p_confirm: body.action === 'clear'
                });
            } else if (body.action === 'read' || body.action === 'delete') {
                const id = activityUuid(body.id);
                result =
                    body.action === 'read' ?
                        await db
                            .from('db_admin_notifications')
                            .update({ read_at: new Date().toISOString() })
                            .eq('id', id)
                            .is('read_at', null)
                            .select('id')
                    :   await db.from('db_admin_notifications').delete().eq('id', id).select('id');
            } else if (body.action === 'pin' || body.action === 'unpin') {
                result = await db
                    .from('db_admin_notifications')
                    .update({ pinned_at: body.action === 'pin' ? new Date().toISOString() : null })
                    .eq('id', activityUuid(body.id))
                    .select('id');
            } else if (body.action === 'read_all') {
                result = await db
                    .from('db_admin_notifications')
                    .update({ read_at: new Date().toISOString() })
                    .is('read_at', null)
                    .lte('created_at', new Date().toISOString());
            } else throw new ActivityInputError('Invalid notification action.');
        } else if (request.method === 'GET') {
            const params = url.searchParams;
            if (inbox) {
                const query = params.get('query') ?? '';
                if (query.length > 200) throw new ActivityInputError('Search is too long.');
                let cursor = null;
                if (params.has('cursor')) {
                    const value = params.get('cursor')!;
                    if (value.length > 2000) throw new ActivityInputError('Invalid cursor.');
                    try {
                        cursor = JSON.parse(value);
                    } catch {
                        throw new ActivityInputError('Invalid cursor.');
                    }
                    if (
                        !cursor
                        || typeof cursor.value !== 'string'
                        || cursor.value.length > 1000
                        || typeof cursor.date !== 'string'
                        || !Number.isFinite(Date.parse(cursor.date))
                    )
                        throw new ActivityInputError('Invalid cursor.');
                    cursor = {
                        value: cursor.value,
                        date: new Date(cursor.date).toISOString(),
                        id: activityUuid(cursor.id)
                    };
                }
                result = await db.rpc('db_admin_inbox', {
                    p_query: query,
                    p_type: choice(
                        params.get('type'),
                        [
                            'all',
                            'comment_new',
                            'comment_report',
                            'helpful',
                            'unhelpful',
                            'contact_message',
                            'feedback_report'
                        ],
                        'all'
                    ),
                    p_read: choice(params.get('read'), ['all', 'read', 'unread'], 'all'),
                    p_sort: choice(params.get('sort'), ['date', 'type', 'page'], 'date'),
                    p_direction: choice(params.get('direction'), ['asc', 'desc'], 'desc'),
                    p_cursor: cursor
                });
            } else {
                const section = choice(
                    params.get('section'),
                    ['stats', 'feedback', 'feedback_history', 'reports', 'report_history'],
                    'stats'
                );
                const pageOffset = offset(params.get('offset'));
                const focusId = optionalId(params.get('focusId'));
                if (section === 'stats') result = await db.rpc('db_admin_dashboard');
                else if (section === 'feedback' || section === 'feedback_history') {
                    const target =
                        params.has('targetId') ?
                            activityTarget(params.get('targetType'), params.get('targetId'))
                        :   null;
                    if (section === 'feedback_history' && !target)
                        throw new ActivityInputError('A page is required.');
                    result = await db.rpc(
                        section === 'feedback' ?
                            'db_admin_feedback_groups'
                        :   'db_admin_feedback_history',
                        {
                            p_offset: pageOffset,
                            p_target_type: target?.type ?? null,
                            p_target_id: target?.id ?? null,
                            ...(section === 'feedback_history' ? { p_focus_id: focusId } : {})
                        }
                    );
                } else if (section === 'reports') {
                    result = await db.rpc('db_admin_report_groups', {
                        p_offset: pageOffset,
                        p_post_id: optionalId(params.get('postId')),
                        p_focus_id: focusId
                    });
                } else {
                    const reason = params.get('reason');
                    if (reason !== null && (reason.length > 80 || !/^[a-z_]+$/.test(reason)))
                        throw new ActivityInputError('Invalid report reason.');
                    result = await db.rpc('db_admin_report_history', {
                        p_comment_id: activityUuid(params.get('commentId')),
                        p_reason: reason,
                        p_offset: pageOffset,
                        p_focus_id: focusId
                    });
                }
            }
        } else return fail(405, 'ADMIN_ACTIVITY_METHOD_INVALID', 'Method not allowed.');
        if (result.error) {
            if (
                result.error.message.includes('CLEAR_OPERATION_CONFLICT')
                || result.error.message.includes('CLEAR_NOT_PREPARED')
            )
                return fail(409, 'ADMIN_CLEAR_CONFLICT', 'This clear operation is not available.');
            return fail(
                503,
                'ADMIN_ACTIVITY_UNAVAILABLE',
                'Activity could not be loaded or updated. Please try again.'
            );
        }
        return Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof ActivityInputError)
            return fail(error.status, 'ADMIN_ACTIVITY_INVALID', error.message);
        return fail(
            503,
            'ADMIN_ACTIVITY_UNAVAILABLE',
            'Activity could not be loaded or updated. Please try again.'
        );
    }
}
