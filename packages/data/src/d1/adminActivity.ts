// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    ActivityPage,
    AdminActivityStore,
    AdminReply,
    AdminReplyResult,
    ClearNotifications,
    InboxQuery,
    NotificationGroupAction,
    SubscriberStats
} from '../activity';
import { DataError } from '../errors';
import { flag, type D1Like, type D1Row } from './client';
import { analyticsSeries, topPages, viewCalendar } from './analytics';
import { webSearchMatcher } from './search';
import { addDays, isTimeZone, localDate, localMidnight } from './time';

type Row = D1Row;
type Options = Record<string, unknown>;

const INBOX_TYPES = [
    'all',
    'comment_report',
    'comment_new',
    'helpful',
    'unhelpful',
    'contact_message',
    'feedback_report'
];
const FEEDBACK_KINDS = ['post_feedback', 'legal_feedback'];

function parseObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string') return {};
    try {
        const parsed: unknown = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ?
                (parsed as Record<string, unknown>)
            :   {};
    } catch {
        return {};
    }
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function notificationItem(row: Row) {
    return {
        id: row.id,
        kind: row.kind,
        post_id: row.post_id ?? null,
        comment_id: row.comment_id ?? null,
        source_id: row.source_id ?? null,
        meta: parseObject(row.meta),
        created_at: row.created_at,
        read_at: row.read_at ?? null,
        page_type: row.page_type ?? null,
        page_id: row.page_id ?? null,
        page_title: row.page_title ?? null,
        page_url: row.page_url ?? null,
        report_status: row.report_status ?? null,
        type_label: row.type_label,
        pinned_at: row.pinned_at ?? null
    };
}

function windowStart(index: number, size: number, offset: number, focused: boolean) {
    if (!focused) return Math.max(offset, 0);
    return index >= 0 ? Math.floor(index / size) * size : 0;
}

function pageOf<T>(rows: T[], start: number, size: number) {
    return rows.slice(start, start + size);
}

function compareKeys(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : 1;
}

function groupTarget(row: Row): string {
    const meta = parseObject(row.meta);
    if (row.kind === 'comment_report') return String(row.comment_id ?? row.id);
    if (row.kind === 'comment_new') return String(row.post_id ?? row.id);
    if (FEEDBACK_KINDS.includes(String(row.kind)))
        return String(meta.page_id ?? row.post_id ?? row.id);
    return String(row.id);
}

function groupVote(row: Row): string {
    return FEEDBACK_KINDS.includes(String(row.kind)) ? text(parseObject(row.meta).vote) : '';
}

export function notificationGroupId(row: Row, timeZone: string): string {
    const values = [
        String(row.kind),
        groupTarget(row),
        groupVote(row),
        localDate(Date.parse(String(row.created_at)), timeZone)
    ];
    return `[${values.map(value => JSON.stringify(value)).join(', ')}]`;
}

function parseGroupId(id: string): [string, string, string, string] {
    const parsed: unknown = JSON.parse(id);
    if (!Array.isArray(parsed) || parsed.length < 4) throw new Error('INVALID_GROUP');
    return parsed.map(value => (value === null ? '' : String(value))) as [
        string,
        string,
        string,
        string
    ];
}

function matchesType(row: Row, type: string): boolean {
    if (type === 'all' || row.kind === type) return true;
    if (!FEEDBACK_KINDS.includes(String(row.kind))) return false;
    const vote = parseObject(row.meta).vote;
    return (type === 'helpful' && vote === 'yes') || (type === 'unhelpful' && vote === 'no');
}

function metaSearchText(row: Row): string {
    const meta = parseObject(row.meta);
    return ['page_title', 'author', 'comment', 'reason', 'details']
        .map(key => text(meta[key]))
        .join(' ');
}

export function createD1AdminActivityStore(db: D1Like): AdminActivityStore {
    async function all(sql: string, ...params: unknown[]) {
        return (
            await db
                .prepare(sql)
                .bind(...params)
                .all()
        ).results;
    }

    async function first(sql: string, ...params: unknown[]) {
        return db
            .prepare(sql)
            .bind(...params)
            .first();
    }

    async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
        try {
            return await task();
        } catch (error) {
            if (error instanceof DataError) throw error;
            throw new DataError(operation, error);
        }
    }

    async function changes(operation: string, sql: string, ...params: unknown[]) {
        return guarded(
            operation,
            async () =>
                (
                    await db
                        .prepare(sql)
                        .bind(...params)
                        .run()
                ).meta.changes
        );
    }

    async function notificationItems(ids: string[]) {
        if (!ids.length) return new Map<string, ReturnType<typeof notificationItem>>();
        const rows = await all(
            'SELECT * FROM db_admin_notification_items WHERE id IN (SELECT value FROM json_each(?1))',
            JSON.stringify(ids)
        );
        return new Map(rows.map(row => [String(row.id), notificationItem(row)]));
    }

    async function workspaceList(section: string, o: Options) {
        const asOf = String(o.asOf);
        const from = typeof o.from === 'string' ? o.from : null;
        const to = String(o.to);
        const query = text(o.query);
        const matches = webSearchMatcher(query);
        const focus = typeof o.focus === 'string' ? o.focus : null;
        const sort = text(o.sort);
        const asc = o.direction === 'asc';
        const sources: Array<{ id: string; payload: unknown; n: number; t: string | null }> = [];

        if (section === 'reports') {
            const rows = await all(
                `SELECT r.comment_id, r.reason, r.created_at, c.post_id, c.author_name, c.is_anonymous, c.content, p.title
                 FROM db_comment_reports r JOIN db_comments c ON c.id = r.comment_id JOIN db_posts p ON p.id = c.post_id
                 WHERE r.created_at <= ?1 AND (?2 IS NULL OR r.created_at >= ?2) AND r.created_at < ?3 AND (?4 = '' OR r.reason = ?4)`,
                asOf,
                from,
                to,
                text(o.reason)
            );
            const groups = new Map<string, Row[]>();
            for (const row of rows) {
                const key = String(row.comment_id);
                groups.set(key, [...(groups.get(key) ?? []), row]);
            }
            for (const [commentId, reports] of groups) {
                const head = reports[0];
                if (o.postId && head.post_id !== o.postId) continue;
                if (
                    query
                    && !matches(
                        `${text(head.content)} ${text(head.author_name)} ${text(head.title)}`
                    )
                )
                    continue;
                const counts = new Map<string, number>();
                for (const report of reports)
                    counts.set(String(report.reason), (counts.get(String(report.reason)) ?? 0) + 1);
                const reason = [...counts.entries()].sort(
                    (a, b) => b[1] - a[1] || compareKeys(a[0], b[0])
                )[0][0];
                const latest = reports
                    .map(report => String(report.created_at))
                    .sort()
                    .at(-1)!;
                sources.push({
                    id: commentId,
                    payload: {
                        id: commentId,
                        title: head.title,
                        postId: head.post_id,
                        author:
                            flag(head.is_anonymous) ? 'Anonymous' : (
                                (head.author_name ?? 'Anonymous')
                            ),
                        content: head.content,
                        total: reports.length,
                        latest,
                        reason
                    },
                    n: sort === 'total' ? reports.length : 0,
                    t: sort === 'page' ? text(head.title).toLowerCase() : latest
                });
            }
        } else if (section === 'feedback') {
            const rows = await all(
                `SELECT f.target_type, f.target_id, f.page_title, f.vote, f.created_at, p.title AS post_title, l.title AS legal_title
                 FROM db_feedback_events f
                 LEFT JOIN db_posts p ON f.target_type = 'article' AND p.id = f.target_id
                 LEFT JOIN db_legals l ON f.target_type = 'legal' AND l.slug = f.target_id
                 WHERE (?1 IS NULL OR f.created_at >= ?1) AND f.created_at < ?2 AND f.created_at <= ?3 AND (?4 = 'all' OR f.target_type = ?4)`,
                from,
                to,
                asOf,
                text(o.type) || 'all'
            );
            const groups = new Map<string, Row[]>();
            for (const row of rows) {
                const key = `${row.target_type}:${row.target_id}`;
                groups.set(key, [...(groups.get(key) ?? []), row]);
            }
            for (const [id, events] of groups) {
                const head = events[0];
                const pageTitle =
                    events
                        .map(event => text(event.page_title))
                        .sort()
                        .at(-1) ?? '';
                const title = (head.post_title ?? head.legal_title ?? pageTitle) as string;
                if (query && !matches(title)) continue;
                const helpful = events.filter(event => event.vote === 'yes').length;
                const unhelpful = events.filter(event => event.vote === 'no').length;
                const latest = events
                    .map(event => String(event.created_at))
                    .sort()
                    .at(-1)!;
                sources.push({
                    id,
                    payload: {
                        id,
                        title,
                        targetType: head.target_type,
                        targetId: head.target_id,
                        total: events.length,
                        helpful,
                        unhelpful,
                        latest
                    },
                    n:
                        sort === 'total' ? events.length
                        : sort === 'helpful' ? Math.round((helpful / events.length) * 1e6) / 1e6
                        : 0,
                    t: sort === 'page' ? title.toLowerCase() : latest
                });
            }
        } else if (section === 'report_events') {
            const rows = await all(
                `SELECT id, reason, details, created_at FROM db_comment_reports
                 WHERE comment_id = ?1 AND created_at <= ?2
                     AND (?3 IS NOT NULL OR ((?4 IS NULL OR created_at >= ?4) AND created_at < ?5))
                     AND (?6 = '' OR reason = ?6) AND (?3 IS NULL OR id = ?3)`,
                text(o.id),
                asOf,
                focus,
                from,
                to,
                text(o.reason)
            );
            for (const row of rows) {
                if (query && !matches(text(row.details))) continue;
                const createdAt = String(row.created_at);
                sources.push({
                    id: String(row.id),
                    payload: {
                        id: row.id,
                        title: row.reason,
                        reason: row.reason,
                        details: row.details ?? null,
                        latest: createdAt,
                        total: 1
                    },
                    n: 0,
                    t:
                        sort === 'reason' ? `${row.reason} ${createdAt}`
                        : sort === 'details' ? `${text(row.details).toLowerCase()} ${createdAt}`
                        : createdAt
                });
            }
        } else if (section === 'feedback_events') {
            const rows = await all(
                `SELECT id, page_title, vote, created_at FROM db_feedback_events
                 WHERE target_type || ':' || target_id = ?1 AND created_at <= ?2
                     AND (?3 IS NOT NULL OR ((?4 IS NULL OR created_at >= ?4) AND created_at < ?5))
                     AND (?6 = 'all' OR vote = ?6) AND (?3 IS NULL OR id = ?3)`,
                text(o.id),
                asOf,
                focus,
                from,
                to,
                text(o.vote) || 'all'
            );
            for (const row of rows)
                sources.push({
                    id: String(row.id),
                    payload: {
                        id: row.id,
                        title: row.page_title,
                        vote: row.vote,
                        latest: row.created_at,
                        total: 1
                    },
                    n: 0,
                    t: String(row.created_at)
                });
        } else if (section === 'notifications' || section === 'notification_events') {
            const timeZone = text(o.timeZone) || 'UTC';
            const rows = (
                await all(
                    `SELECT * FROM db_admin_notifications
                     WHERE dismissed_at IS NULL AND created_at <= ?1 AND (?2 IS NULL OR created_at >= ?2) AND created_at < ?3
                         AND (?4 = 'all' OR (?4 = 'read') = (read_at IS NOT NULL))`,
                    asOf,
                    from,
                    to,
                    text(o.read) || 'all'
                )
            ).filter(
                row =>
                    matchesType(row, text(o.type) || 'all')
                    && (!query || matches(metaSearchText(row)))
            );
            const group = section === 'notification_events' ? parseGroupId(text(o.id)) : null;
            const selected =
                group ?
                    rows.filter(
                        row =>
                            row.kind === group[0]
                            && groupTarget(row) === group[1]
                            && groupVote(row) === group[2]
                            && localDate(Date.parse(String(row.created_at)), timeZone) === group[3]
                            && (!focus || row.id === focus)
                    )
                :   rows;
            const items = await notificationItems(selected.map(row => String(row.id)));
            for (const row of selected) {
                const item = items.get(String(row.id));
                if (!item) continue;
                const createdAt = String(row.created_at);
                sources.push(
                    group ?
                        {
                            id: String(row.id),
                            payload: {
                                id: row.id,
                                title: text(parseObject(row.meta).page_title) || 'Notification',
                                total: 1,
                                latest: createdAt,
                                event: item
                            },
                            n: 0,
                            t: createdAt
                        }
                    :   {
                            id: String(row.id),
                            payload: {
                                id: row.id,
                                title: item.page_title ?? 'Notification',
                                total: 1,
                                latest: createdAt,
                                event: item
                            },
                            n:
                                item.pinned_at === null ? 0
                                : asc ? -1
                                : 1,
                            t:
                                sort === 'type' ? String(row.kind)
                                : sort === 'page' ?
                                    text(item.page_title ?? 'Notification').toLowerCase()
                                :   createdAt
                        }
                );
            }
        } else if (section === 'comments') {
            const rows = await all(
                `SELECT c.*, (SELECT count(*) FROM db_comment_reports r WHERE r.comment_id = c.id) AS reports
                 FROM db_comments c
                 WHERE c.post_id = ?1 AND c.created_at <= ?2 AND (?3 IS NULL OR c.id = ?3)
                     AND (?4 = '' OR EXISTS (SELECT 1 FROM db_comment_reports r WHERE r.comment_id = c.id))`,
                text(o.id),
                asOf,
                focus,
                text(o.reason)
            );
            for (const row of rows)
                sources.push({
                    id: String(row.id),
                    payload: {
                        id: row.id,
                        title: row.author_name ?? 'Anonymous',
                        content: row.content,
                        total: 1,
                        latest: row.created_at,
                        comment: {
                            id: row.id,
                            post_id: row.post_id,
                            parent_id: row.parent_id ?? null,
                            author_name: row.author_name,
                            content: row.content,
                            is_anonymous: flag(row.is_anonymous),
                            is_admin: flag(row.is_admin),
                            is_approved: flag(row.is_approved),
                            created_at: row.created_at,
                            reports: Number(row.reports)
                        }
                    },
                    n: 0,
                    t: String(row.created_at)
                });
        } else throw new DataError('activity.db_admin_workspace', 'INVALID_SECTION');

        const direction = asc ? 1 : -1;
        sources.sort(
            (a, b) =>
                direction
                * (compareKeys(a.n, b.n) || compareKeys(a.t, b.t) || compareKeys(a.id, b.id))
        );
        const limit = Math.min(20, Math.max(1, Number(o.limit ?? 20) || 20));
        const page = Math.min(10000, Math.max(1, Number(o.page ?? 1) || 1));
        return {
            items: sources.slice((page - 1) * limit, page * limit).map(source => source.payload),
            total: sources.length,
            page,
            asOf
        };
    }

    async function workspace(section: string, options: Options) {
        const o: Options = {
            ...options,
            asOf: options.asOf ?? new Date().toISOString(),
            query: options.query ?? '',
            timeZone: options.timeZone ?? 'UTC',
            id: options.id ?? '',
            type: options.type ?? 'all',
            read: options.read ?? 'all',
            sort: options.sort ?? 'date',
            vote: options.vote ?? 'all',
            reason: options.reason ?? ''
        };
        const timeZone = String(o.timeZone);
        if (!isTimeZone(timeZone))
            throw new DataError('activity.db_admin_workspace', 'Invalid time zone');
        const asOf = String(o.asOf);
        if (section === 'summary') {
            const row = await first(
                `SELECT count(*) AS total, sum(read_at IS NULL) AS unread, max(created_at) AS created, max(read_at) AS read
                 FROM db_admin_notifications WHERE dismissed_at IS NULL`
            );
            const total = Number(row?.total ?? 0);
            const unread = Number(row?.unread ?? 0);
            return {
                unreadCount: unread,
                total,
                revision: `${total}:${unread}:${row?.created ?? ''}:${row?.read ?? ''}`
            };
        }
        if (section === 'calendar') return viewCalendar(db, asOf, timeZone);
        if (section === 'overview') {
            const series = await analyticsSeries(db, String(o.from), String(o.to), timeZone);
            const counts = await first(
                `SELECT (SELECT count(*) FROM db_comment_reports) AS openReports,
                     (SELECT count(DISTINCT comment_id) FROM db_comment_reports) AS reportedComments,
                     (SELECT count(*) FROM db_posts WHERE published = 1) AS published,
                     (SELECT count(*) FROM db_posts) AS posts,
                     (SELECT count(*) FROM db_views) AS allTimeReads,
                     (SELECT count(*) FROM db_feedback_events WHERE vote = 'yes') AS allTimeHelpful,
                     (SELECT count(*) FROM db_feedback_events WHERE vote = 'no') AS allTimeUnhelpful`
            );
            const sum = (key: 'views' | 'helpful' | 'unhelpful') =>
                series.reduce((total, point) => total + point[key], 0);
            return {
                openReports: Number(counts?.openReports ?? 0),
                reportedComments: Number(counts?.reportedComments ?? 0),
                published: Number(counts?.published ?? 0),
                posts: Number(counts?.posts ?? 0),
                series,
                reads: sum('views'),
                helpful: sum('helpful'),
                unhelpful: sum('unhelpful'),
                allTimeReads: Number(counts?.allTimeReads ?? 0),
                allTimeHelpful: Number(counts?.allTimeHelpful ?? 0),
                allTimeUnhelpful: Number(counts?.allTimeUnhelpful ?? 0),
                topPages: await topPages(db),
                from: o.from ?? null,
                to: o.to ?? null,
                timeZone,
                updatedAt: asOf
            };
        }
        let context: unknown = null;
        if (section === 'feedback_events') {
            const row = await first(
                `SELECT coalesce(p.title, l.title, f.page_title) AS title FROM db_feedback_events f
                 LEFT JOIN db_posts p ON f.target_type = 'article' AND p.id = f.target_id
                 LEFT JOIN db_legals l ON f.target_type = 'legal' AND l.slug = f.target_id
                 WHERE f.target_type || ':' || f.target_id = ?1 ORDER BY f.created_at DESC, f.id DESC LIMIT 1`,
                text(o.id)
            );
            context = row ? { title: row.title, id: o.id } : null;
            if (o.events === false || o.events === 'false') {
                const series = await analyticsSeries(
                    db,
                    String(o.from),
                    String(o.to),
                    timeZone,
                    text(o.id)
                );
                return {
                    items: [],
                    asOf,
                    page: 1,
                    context,
                    series,
                    total: series.reduce(
                        (total, point) => total + point.helpful + point.unhelpful,
                        0
                    )
                };
            }
        }
        const result: Record<string, unknown> = await workspaceList(section, o);
        if (section === 'report_events') {
            const notificationId = typeof o.notificationId === 'string' ? o.notificationId : '';
            const saved =
                notificationId ?
                    (await notificationItems([notificationId])).get(notificationId)
                :   null;
            const comment = await first(
                `SELECT c.id, c.post_id, p.title, c.is_anonymous, c.author_name, c.content, c.created_at,
                     (SELECT count(*) FROM db_comment_reports WHERE comment_id = c.id) AS total
                 FROM db_comments c JOIN db_posts p ON p.id = c.post_id WHERE c.id = ?1`,
                text(o.id)
            );
            const reasonRows = await all(
                `SELECT reason, details FROM db_comment_reports
                 WHERE comment_id = ?1 AND created_at <= ?2 AND (?3 IS NULL OR created_at >= ?3) AND created_at < ?4`,
                text(o.id),
                asOf,
                typeof o.from === 'string' ? o.from : null,
                String(o.to)
            );
            const matches = webSearchMatcher(text(o.query));
            const reasons = new Map<string, number>();
            for (const row of reasonRows)
                if (!text(o.query) || matches(text(row.details)))
                    reasons.set(String(row.reason), (reasons.get(String(row.reason)) ?? 0) + 1);
            Object.assign(result, {
                savedNotification: saved ?? null,
                context:
                    comment ?
                        {
                            id: comment.id,
                            postId: comment.post_id,
                            title: comment.title,
                            author:
                                flag(comment.is_anonymous) ? 'Anonymous' : (
                                    (comment.author_name ?? 'Anonymous')
                                ),
                            content: comment.content,
                            commentedAt: comment.created_at,
                            total: Number(comment.total)
                        }
                    :   null,
                reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count }))
            });
        } else if (section === 'feedback_events' && o.meta !== false && o.meta !== 'false') {
            result.series = await analyticsSeries(
                db,
                String(o.from),
                String(o.to),
                timeZone,
                text(o.id)
            );
        }
        if (section === 'feedback_events') result.context = context;
        return result;
    }

    return {
        dashboard: () =>
            guarded('activity.db_admin_dashboard', async () => {
                const row = await first(
                    `SELECT (SELECT count(*) FROM db_feedback_events WHERE vote = 'yes') AS helpful,
                         (SELECT count(*) FROM db_feedback_events WHERE vote = 'no') AS unhelpful,
                         (SELECT count(*) FROM db_comment_reports) AS openReports,
                         (SELECT count(DISTINCT comment_id) FROM db_comment_reports) AS reportedComments,
                         (SELECT count(*) FROM db_posts WHERE published = 1) AS published,
                         (SELECT count(*) FROM db_posts) AS posts`
                );
                return Object.fromEntries(
                    Object.entries(row ?? {}).map(([key, value]) => [key, Number(value)])
                );
            }),

        feedbackGroups: ({ offset, page }: { offset: number; page: ActivityPage | null }) =>
            guarded('activity.db_admin_feedback_groups', async () => {
                const rows = await all(
                    'SELECT * FROM db_admin_feedback_items ORDER BY created_at DESC, id DESC'
                );
                const groups = new Map<
                    string,
                    Row & { helpful: number; unhelpful: number; latest: string }
                >();
                for (const row of rows) {
                    const key = `${row.target_type}\u0000${row.target_id}`;
                    const group = groups.get(key) ?? {
                        target_type: row.target_type,
                        target_id: row.target_id,
                        page_title: row.page_title ?? null,
                        page_url: row.page_url ?? null,
                        helpful: 0,
                        unhelpful: 0,
                        latest: String(row.created_at)
                    };
                    if (row.vote === 'yes') group.helpful++;
                    if (row.vote === 'no') group.unhelpful++;
                    groups.set(key, group);
                }
                const ranked = [...groups.values()].sort(
                    (a, b) =>
                        compareKeys(b.latest, a.latest)
                        || compareKeys(a.target_type, b.target_type)
                        || compareKeys(a.target_id, b.target_id)
                );
                const start = windowStart(
                    ranked.findIndex(
                        group => group.target_type === page?.type && group.target_id === page?.id
                    ),
                    10,
                    offset,
                    page !== null
                );
                return {
                    items: pageOf(ranked, start, 10),
                    offset: start,
                    total: ranked.length,
                    pageSize: 10
                };
            }),

        feedbackHistory: ({ offset, page, focusId }) =>
            guarded('activity.db_admin_feedback_history', async () => {
                const rows = await all(
                    `SELECT * FROM db_admin_feedback_items WHERE target_type = ?1 AND target_id = ?2
                     ORDER BY created_at DESC, id DESC`,
                    page.type,
                    page.id
                );
                const start = windowStart(
                    rows.findIndex(row => row.id === focusId),
                    20,
                    offset,
                    focusId !== null
                );
                return {
                    items: pageOf(rows, start, 20),
                    offset: start,
                    total: rows.length,
                    pageSize: 20
                };
            }),

        reportGroups: ({ offset, postId, focusId }) =>
            guarded('activity.db_admin_report_groups', async () => {
                const rows = await all(
                    'SELECT * FROM db_admin_report_items WHERE ?1 IS NULL OR post_id = ?1',
                    postId
                );
                const groups = new Map<string, Row[]>();
                for (const row of rows) {
                    const key = String(postId === null ? row.post_id : row.comment_id);
                    groups.set(key, [...(groups.get(key) ?? []), row]);
                }
                const max = (items: Row[], key: string) =>
                    items
                        .map(item => item[key])
                        .filter(value => value !== null && value !== undefined)
                        .sort(compareKeys)
                        .at(-1) ?? null;
                const ranked = [...groups.entries()]
                    .map(([id, items]) => ({
                        id,
                        post_id: max(items, 'post_id'),
                        page_title: max(items, 'page_title'),
                        page_url: max(items, 'page_url'),
                        author: postId === null ? null : max(items, 'author'),
                        content: postId === null ? null : max(items, 'content'),
                        reports: items.length,
                        comments: new Set(items.map(item => item.comment_id)).size,
                        latest: max(items, 'created_at'),
                        hasFocus: items.some(item => item.id === focusId)
                    }))
                    .sort((a, b) => compareKeys(b.latest, a.latest) || compareKeys(b.id, a.id));
                const start = windowStart(
                    ranked.findIndex(group => group.hasFocus),
                    10,
                    offset,
                    focusId !== null
                );
                return {
                    items: pageOf(ranked, start, 10).map(({ hasFocus: _focus, ...group }) => group),
                    offset: start,
                    total: ranked.length,
                    pageSize: 10
                };
            }),

        reportHistory: ({ commentId, reason, offset, focusId }) =>
            guarded('activity.db_admin_report_history', async () => {
                const reports = await all(
                    'SELECT * FROM db_admin_report_items WHERE comment_id = ?1 ORDER BY created_at DESC, id DESC',
                    commentId
                );
                const rows = reports.filter(row => reason === null || row.reason === reason);
                const start = windowStart(
                    rows.findIndex(row => row.id === focusId),
                    20,
                    offset,
                    focusId !== null
                );
                const reasons = new Map<
                    string,
                    { reason: string; count: number; latest: string }
                >();
                for (const row of reports) {
                    const key = String(row.reason);
                    const entry = reasons.get(key) ?? {
                        reason: key,
                        count: 0,
                        latest: String(row.created_at)
                    };
                    entry.count++;
                    if (String(row.created_at) > entry.latest)
                        entry.latest = String(row.created_at);
                    reasons.set(key, entry);
                }
                return {
                    items: pageOf(rows, start, 20),
                    reasons: [...reasons.values()].sort(
                        (a, b) => compareKeys(b.latest, a.latest) || compareKeys(a.reason, b.reason)
                    ),
                    offset: start,
                    total: rows.length,
                    pageSize: 20
                };
            }),

        inbox: (query: InboxQuery) =>
            guarded('activity.db_admin_inbox', async () => {
                if (
                    query.query.length > 200
                    || !['date', 'type', 'page'].includes(query.sort)
                    || !['asc', 'desc'].includes(query.direction)
                    || !['all', 'read', 'unread'].includes(query.read)
                    || !INBOX_TYPES.includes(query.type)
                )
                    throw new DataError('activity.db_admin_inbox', 'INBOX_FILTER_INVALID');
                const search = query.query.toLowerCase();
                const items = (await all('SELECT * FROM db_admin_notification_items'))
                    .map(notificationItem)
                    .filter(
                        item =>
                            (query.read === 'all'
                                || (query.read === 'read') === (item.read_at !== null))
                            && matchesType(
                                { kind: item.kind, meta: JSON.stringify(item.meta) },
                                query.type
                            )
                            && (search === ''
                                || [
                                    item.page_title,
                                    item.type_label,
                                    item.meta.author,
                                    item.meta.comment,
                                    item.meta.reason,
                                    item.meta.details
                                ]
                                    .filter(value => typeof value === 'string' && value)
                                    .join(' ')
                                    .toLowerCase()
                                    .includes(search))
                    )
                    .map(item => ({
                        item,
                        sortValue:
                            query.sort === 'type' ? String(item.type_label).toLowerCase()
                            : query.sort === 'page' ? text(item.page_title).toLowerCase()
                            : ''
                    }));
                const dateAsc = query.sort === 'date' && query.direction === 'asc';
                const newerFirst = (a: (typeof items)[number], b: (typeof items)[number]) =>
                    compareKeys(b.item.created_at, a.item.created_at)
                    || compareKeys(b.item.id, a.item.id);
                const ordered = [...items].sort((a, b) => {
                    const bySort =
                        query.direction === 'asc' ?
                            compareKeys(a.sortValue, b.sortValue)
                        :   compareKeys(b.sortValue, a.sortValue);
                    return bySort || (dateAsc ? -newerFirst(a, b) : newerFirst(a, b));
                });
                const cursor = query.cursor;
                const remaining =
                    cursor ?
                        ordered.filter(({ item, sortValue }) => {
                            const position =
                                compareKeys(item.created_at, cursor.date)
                                || compareKeys(item.id, cursor.id);
                            if (query.sort === 'date') return dateAsc ? position > 0 : position < 0;
                            const value = compareKeys(sortValue, cursor.value);
                            return (
                                (query.direction === 'asc' ? value > 0 : value < 0)
                                || (value === 0 && position < 0)
                            );
                        })
                    :   ordered;
                const page = remaining.slice(0, 21);
                const last = page[19];
                const unread = await first(
                    'SELECT count(*) AS total FROM db_admin_notifications WHERE dismissed_at IS NULL AND read_at IS NULL'
                );
                return {
                    items: page.slice(0, 20).map(entry => entry.item),
                    nextCursor:
                        page.length > 20 && last ?
                            { value: last.sortValue, date: last.item.created_at, id: last.item.id }
                        :   null,
                    total: items.length,
                    unreadCount: Number(unread?.total ?? 0)
                };
            }),

        markRead: (id: string) =>
            changes(
                'notifications.markRead',
                'UPDATE db_admin_notifications SET read_at = ?2 WHERE id = ?1 AND read_at IS NULL',
                id,
                new Date().toISOString()
            ),

        markAllRead: () =>
            changes(
                'notifications.markAllRead',
                'UPDATE db_admin_notifications SET read_at = ?1 WHERE read_at IS NULL AND created_at <= ?1',
                new Date().toISOString()
            ),

        remove: (id: string) =>
            changes('notifications.remove', 'DELETE FROM db_admin_notifications WHERE id = ?1', id),

        setPinned: (id: string, pinned: boolean) =>
            changes(
                'notifications.setPinned',
                'UPDATE db_admin_notifications SET pinned_at = ?2 WHERE id = ?1',
                id,
                pinned ? new Date().toISOString() : null
            ),

        clearNotifications: ({ actorId, operationId, confirm }) =>
            guarded('notifications.clear', async (): Promise<ClearNotifications> => {
                if (!actorId || !operationId)
                    throw new DataError('notifications.clear', 'CLEAR_INVALID');
                const read = () =>
                    first(
                        'SELECT * FROM db_notification_clear_operations WHERE operation_id = ?1',
                        operationId
                    );
                let operation = await read();
                if (!operation) {
                    if (confirm) return { status: 'conflict' };
                    await db
                        .prepare(
                            `INSERT INTO db_notification_clear_operations (operation_id, actor_id, target_ids)
                             SELECT ?1, ?2, json_group_array(id) FROM db_admin_notifications WHERE read_at IS NOT NULL
                             ON CONFLICT (operation_id) DO NOTHING`
                        )
                        .bind(operationId, actorId)
                        .run();
                    operation = await read();
                }
                if (!operation || operation.actor_id !== actorId) return { status: 'conflict' };
                if (confirm && operation.completed_at === null) {
                    const completedAt = new Date().toISOString();
                    await db.batch([
                        db
                            .prepare(
                                `UPDATE db_notification_clear_operations SET completed_at = ?2,
                                     deleted_count = (SELECT count(*) FROM db_admin_notifications WHERE id IN (SELECT value FROM json_each(target_ids)))
                                 WHERE operation_id = ?1 AND completed_at IS NULL`
                            )
                            .bind(operationId, completedAt),
                        db
                            .prepare(
                                `DELETE FROM db_admin_notifications WHERE id IN (
                                     SELECT value FROM json_each((SELECT target_ids FROM db_notification_clear_operations WHERE operation_id = ?1 AND completed_at = ?2))
                                 )`
                            )
                            .bind(operationId, completedAt)
                    ]);
                    operation = await read();
                }
                const targets = JSON.parse(String(operation?.target_ids ?? '[]')) as unknown[];
                return {
                    status: 'done',
                    result: {
                        operationId,
                        count: targets.length,
                        completed:
                            operation?.completed_at !== null
                            && operation?.completed_at !== undefined,
                        deletedCount: operation?.deleted_count ?? null
                    }
                };
            }),

        workspace: (section: string, options: Options) =>
            guarded('activity.db_admin_workspace', () => workspace(section, options)),

        notificationGroupAction: (action: NotificationGroupAction) =>
            guarded('activity.db_admin_notification_group_action', async () => {
                if (
                    Date.parse(action.asOf) > Date.now()
                    || action.id.length > 1500
                    || !isTimeZone(action.timeZone)
                )
                    throw new DataError(
                        'activity.db_admin_notification_group_action',
                        'INVALID_GROUP'
                    );
                const [kind, , , day] = parseGroupId(action.id);
                const dayStart = new Date(localMidnight(day, action.timeZone)).toISOString();
                const dayEnd = new Date(
                    localMidnight(addDays(day, 1), action.timeZone)
                ).toISOString();
                const rows = await all(
                    `SELECT id, kind, post_id, comment_id, meta, created_at FROM db_admin_notifications
                     WHERE dismissed_at IS NULL AND created_at <= ?1 AND (?2 IS NULL OR created_at >= ?2) AND (?3 IS NULL OR created_at < ?3)
                         AND kind = ?4 AND created_at >= ?5 AND created_at < ?6 ${action.remove ? '' : 'AND read_at IS NULL'}`,
                    action.asOf,
                    action.from,
                    action.to,
                    kind,
                    dayStart,
                    dayEnd
                );
                const ids = rows
                    .filter(row => notificationGroupId(row, action.timeZone) === action.id)
                    .map(row => String(row.id));
                if (!ids.length) return { affected: 0 };
                const affected = await changes(
                    'activity.db_admin_notification_group_action',
                    action.remove ?
                        'DELETE FROM db_admin_notifications WHERE id IN (SELECT value FROM json_each(?1)) AND dismissed_at IS NULL'
                    :   'UPDATE db_admin_notifications SET read_at = ?2 WHERE id IN (SELECT value FROM json_each(?1)) AND read_at IS NULL AND dismissed_at IS NULL',
                    ...(action.remove ?
                        [JSON.stringify(ids)]
                    :   [JSON.stringify(ids), new Date().toISOString()])
                );
                return { affected };
            }),

        deleteComment: (id: string) =>
            guarded('activity.db_admin_delete_comment', async () => {
                const [count] = await db.batch([
                    db
                        .prepare(
                            `WITH RECURSIVE descendants(id) AS (
                                 SELECT id FROM db_comments WHERE id = ?1
                                 UNION SELECT c.id FROM db_comments c JOIN descendants d ON c.parent_id = d.id
                             ) SELECT count(*) AS total FROM descendants`
                        )
                        .bind(id),
                    db.prepare('DELETE FROM db_comments WHERE id = ?1').bind(id)
                ]);
                return { deleted: Number(count.results[0]?.total ?? 0) };
            }),

        replyToComment: (reply: AdminReply) =>
            guarded('activity.replyToComment', async (): Promise<AdminReplyResult> => {
                const parent = await first(
                    'SELECT id FROM db_comments WHERE id = ?1 AND post_id = ?2',
                    reply.parentId,
                    reply.postId
                );
                if (!parent) return { status: 'invalid-parent' };
                const row = await first(
                    `INSERT INTO db_comments (post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved)
                     VALUES (?1, ?2, ?3, ?4, 0, 1, 1)
                     RETURNING id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at`,
                    reply.postId,
                    reply.parentId,
                    reply.authorName,
                    reply.content
                );
                if (!row)
                    throw new DataError('activity.replyToComment', 'The reply was not stored.');
                return {
                    status: 'created',
                    comment: {
                        ...row,
                        is_anonymous: flag(row.is_anonymous),
                        is_admin: flag(row.is_admin),
                        is_approved: flag(row.is_approved)
                    }
                };
            }),

        dismissReports: (commentId: string) =>
            guarded('activity.dismissReports', async () => {
                await db
                    .prepare('DELETE FROM db_comment_reports WHERE comment_id = ?1')
                    .bind(commentId)
                    .run();
            }),

        subscriberStats: () =>
            guarded('activity.db_subscriber_stats', async (): Promise<SubscriberStats> => {
                const row = await first(
                    `SELECT sum(status = 'active') AS active, sum(status = 'pending') AS pending,
                         sum(status = 'unsubscribed') AS unsubscribed FROM db_subscribers`
                );
                return {
                    active: Number(row?.active ?? 0),
                    pending: Number(row?.pending ?? 0),
                    unsubscribed: Number(row?.unsubscribed ?? 0)
                };
            })
    };
}
