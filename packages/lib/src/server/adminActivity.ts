import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminActivityStore } from '@idstead/data';
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
    input: {
        request: Request;
        url: URL;
        db: SupabaseClient | null;
        sessionDb?: SupabaseClient | null;
    },
    inbox: boolean
) {
    const { request, url, db, sessionDb } = input;
    const fail = apiError;
    if (!db)
        return fail(
            503,
            'ADMIN_ACTIVITY_UNAVAILABLE',
            'Admin activity is temporarily unavailable.'
        );
    try {
        const auth = await blogAdmin(request, url, db);
        if (auth.status)
            return fail(auth.status, auth.code ?? 'ADMIN_ACTIVITY_AUTH_REQUIRED', auth.message);
        const store = createSupabaseAdminActivityStore(db);
        let result: unknown;
        if (request.method === 'POST' && inbox) {
            const body = await activityJson(request);
            if (body.action === 'prepare_clear' || body.action === 'clear') {
                const cleared = await store.clearNotifications({
                    actorId: auth.actor,
                    operationId: activityUuid(body.operationId),
                    confirm: body.action === 'clear'
                });
                if (cleared.status === 'conflict')
                    return fail(
                        409,
                        'ADMIN_CLEAR_CONFLICT',
                        'This clear operation is not available.'
                    );
                result = cleared.result;
            } else if (body.action === 'read' || body.action === 'delete') {
                const id = activityUuid(body.id);
                result = {
                    updated: await (body.action === 'read' ? store.markRead(id) : store.remove(id))
                };
            } else if (body.action === 'pin' || body.action === 'unpin') {
                result = {
                    updated: await store.setPinned(activityUuid(body.id), body.action === 'pin')
                };
            } else if (body.action === 'read_all') {
                result = { updated: await store.markAllRead() };
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
                result = await store.inbox({
                    query,
                    type: choice(
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
                    read: choice(params.get('read'), ['all', 'read', 'unread'], 'all'),
                    sort: choice(params.get('sort'), ['date', 'type', 'page'], 'date'),
                    direction: choice(params.get('direction'), ['asc', 'desc'], 'desc'),
                    cursor
                });
            } else {
                const section = choice(
                    params.get('section'),
                    [
                        'stats',
                        'subscribers',
                        'feedback',
                        'feedback_history',
                        'reports',
                        'report_history'
                    ],
                    'stats'
                );
                const pageOffset = offset(params.get('offset'));
                const focusId = optionalId(params.get('focusId'));
                if (section === 'stats') result = await store.dashboard();
                else if (section === 'subscribers') {
                    if (!sessionDb)
                        return fail(
                            503,
                            'ADMIN_ACTIVITY_UNAVAILABLE',
                            'Subscriber counts are temporarily unavailable.'
                        );
                    result = await createSupabaseAdminActivityStore(sessionDb).subscriberStats();
                } else if (section === 'feedback' || section === 'feedback_history') {
                    const target =
                        params.has('targetId') ?
                            activityTarget(params.get('targetType'), params.get('targetId'))
                        :   null;
                    if (section === 'feedback_history' && !target)
                        throw new ActivityInputError('A page is required.');
                    result =
                        section === 'feedback' || !target ?
                            await store.feedbackGroups({ offset: pageOffset, page: target })
                        :   await store.feedbackHistory({
                                offset: pageOffset,
                                page: target,
                                focusId
                            });
                } else if (section === 'reports') {
                    result = await store.reportGroups({
                        offset: pageOffset,
                        postId: optionalId(params.get('postId')),
                        focusId
                    });
                } else {
                    const reason = params.get('reason');
                    if (reason !== null && (reason.length > 80 || !/^[a-z_]+$/.test(reason)))
                        throw new ActivityInputError('Invalid report reason.');
                    result = await store.reportHistory({
                        commentId: activityUuid(params.get('commentId')),
                        reason,
                        offset: pageOffset,
                        focusId
                    });
                }
            }
        } else return fail(405, 'ADMIN_ACTIVITY_METHOD_INVALID', 'Method not allowed.');
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
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
