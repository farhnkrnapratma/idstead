import { isLegalSlug } from '@idstead/domain/legal.ts';
import type {
    ActivityEntry,
    ActivityLog,
    ActivityLogFilter,
    ActivityLogPage,
    AdminNotificationKind,
    AdminNotifier,
    AdminSettingsStore,
    FeedbackRecorder,
    FeedbackRecording,
    FeedbackTarget,
    PageFeedback
} from '../activity';
import { DataError } from '../errors';
import { sourceRecord } from '../source';
import { flag, type D1Like, type D1Row } from './client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IP_HASH = /^[a-f0-9]{64}$/;
const LOG_SORTS = ['created_at', 'category', 'action', 'actor', 'summary', 'ip'];
const LOG_CATEGORIES = ['profile', 'resume', 'skills', 'links', 'blog', 'auth', 'security'];

function parseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function createD1FeedbackRecorder(db: D1Like): FeedbackRecorder {
    return {
        async record(target: FeedbackTarget, feedback: PageFeedback): Promise<FeedbackRecording> {
            const targetId =
                target.type === 'article' ? sourceRecord(target.post.source).postId : target.page;
            if (
                !UUID.test(feedback.operationId)
                || targetId.length > 80
                || !['yes', 'no'].includes(feedback.vote)
                || !IP_HASH.test(feedback.ipHash)
            )
                throw new DataError('feedback.record', 'FEEDBACK_INVALID');
            try {
                const replay = async () => {
                    const operation = await db
                        .prepare(
                            'SELECT target_type, target_id, vote, recorded FROM db_feedback_operations WHERE operation_id = ?1'
                        )
                        .bind(feedback.operationId)
                        .first();
                    if (!operation) return null;
                    if (
                        operation.target_type !== target.type
                        || operation.target_id !== targetId
                        || operation.vote !== feedback.vote
                    )
                        return { status: 'operation-conflict' } as const;
                    return {
                        status: 'saved',
                        recorded: flag(operation.recorded),
                        replayed: true
                    } as const;
                };
                const earlier = await replay();
                if (earlier) return earlier;
                const page =
                    target.type === 'article' ?
                        await db
                            .prepare(
                                "SELECT id, title FROM db_posts WHERE id = ?1 AND published = 1 AND coalesce(slug, '') <> ''"
                            )
                            .bind(targetId)
                            .first<{ id: string; title: string }>()
                    :   await db
                            .prepare(
                                `SELECT NULL AS id, title FROM db_legals WHERE slug = ?1 AND length(trim(content)) > 0`
                            )
                            .bind(targetId)
                            .first<{ id: null; title: string }>();
                if (!page || (target.type === 'legal' && !isLegalSlug(targetId)))
                    return { status: 'target-not-found' };
                const eventId = crypto.randomUUID();
                const now = new Date().toISOString();
                const dayAgo = new Date(Date.parse(now) - 24 * 60 * 60 * 1000).toISOString();
                const [, , , inserted] = await db.batch([
                    db
                        .prepare(
                            `INSERT INTO db_feedback_events (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at, legacy_id)
                             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CASE WHEN ?4 IS NOT NULL THEN ?1 END
                             WHERE NOT EXISTS (SELECT 1 FROM db_feedback_operations WHERE operation_id = ?9)
                                 AND NOT EXISTS (
                                     SELECT 1 FROM db_feedback_events
                                     WHERE target_type = ?2 AND target_id = ?3 AND ip_hash = ?7 AND created_at > ?10
                                 )`
                        )
                        .bind(
                            eventId,
                            target.type,
                            targetId,
                            page.id,
                            page.title,
                            feedback.vote,
                            feedback.ipHash,
                            now,
                            feedback.operationId,
                            dayAgo
                        ),
                    db
                        .prepare(
                            `INSERT INTO db_post_feedback (id, post_id, vote, ip_hash, created_at)
                             SELECT id, post_id, vote, ip_hash, created_at FROM db_feedback_events
                             WHERE id = ?1 AND post_id IS NOT NULL`
                        )
                        .bind(eventId),
                    db
                        .prepare(
                            `UPDATE db_post_stats SET helpful_yes = helpful_yes + (e.vote = 'yes'), helpful_no = helpful_no + (e.vote = 'no')
                             FROM (SELECT post_id, vote FROM db_feedback_events WHERE id = ?1) AS e
                             WHERE db_post_stats.post_id = e.post_id`
                        )
                        .bind(eventId),
                    db
                        .prepare(
                            `INSERT INTO db_feedback_operations (operation_id, target_type, target_id, vote, ip_hash, recorded, event_id, created_at)
                             SELECT ?1, ?2, ?3, ?4, ?5, e.id IS NOT NULL, e.id, ?6
                             FROM (SELECT 1) LEFT JOIN db_feedback_events e ON e.id = ?7
                             WHERE NOT EXISTS (SELECT 1 FROM db_feedback_operations WHERE operation_id = ?1)
                             RETURNING recorded`
                        )
                        .bind(
                            feedback.operationId,
                            target.type,
                            targetId,
                            feedback.vote,
                            feedback.ipHash,
                            now,
                            eventId
                        )
                ]);
                const row = inserted.results[0];
                if (row) return { status: 'saved', recorded: flag(row.recorded), replayed: false };
                return (await replay()) ?? { status: 'target-not-found' };
            } catch (error) {
                throw new DataError('feedback.record', error);
            }
        }
    };
}

export function createD1AdminNotifier(db: D1Like): AdminNotifier {
    return {
        async notify(kind: AdminNotificationKind) {
            try {
                await db
                    .prepare('INSERT INTO db_admin_notifications (kind) VALUES (?1)')
                    .bind(kind)
                    .run();
            } catch (error) {
                throw new DataError('notifications.notify', error);
            }
        }
    };
}

function timestamp(value: string | null, operation: string): string | null {
    if (value === null) return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) throw new DataError(operation, 'Invalid log query');
    return new Date(parsed).toISOString();
}

function logRow(row: D1Row) {
    return { ...row, details: parseJson(row.details) };
}

export function createD1ActivityLog(db: D1Like): ActivityLog {
    async function page(
        filter: Omit<ActivityLogFilter, 'limit' | 'offset'>,
        limit: number,
        offset: number,
        operation: string
    ): Promise<ActivityLogPage> {
        if (!['asc', 'desc'].includes(filter.direction) || !LOG_SORTS.includes(filter.sort))
            throw new DataError(operation, 'Invalid sort');
        if (filter.category !== null && !LOG_CATEGORIES.includes(filter.category))
            throw new DataError(operation, 'Invalid category');
        const from = timestamp(filter.from, operation);
        const to = timestamp(filter.to, operation);
        if (
            (from && to && from > to)
            || (filter.query ?? '').length > 250
            || !Number.isInteger(limit)
            || limit < 1
            || limit > 5000
            || !Number.isInteger(offset)
            || offset < 0
        )
            throw new DataError(operation, 'Invalid log query');
        const query = (filter.query ?? '').trim().toLowerCase();
        const where = `(?1 IS NULL OR category = ?1) AND (?2 IS NULL OR created_at >= ?2) AND (?3 IS NULL OR created_at <= ?3)
            AND (?4 = '' OR instr(lower(trim(coalesce(actor || ' ', '') || action || ' ' || summary)), ?4) > 0)`;
        const direction = filter.direction === 'asc' ? 'ASC' : 'DESC';
        const order =
            filter.sort === 'created_at' ?
                `created_at ${direction}, id ${direction}`
            :   `lower(${filter.sort}) ${direction} NULLS LAST, created_at ${direction}, id ${direction}`;
        try {
            const params = [filter.category, from, to, query];
            const [rows, count] = await db.batch([
                db
                    .prepare(
                        `SELECT * FROM db_activity_log WHERE ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`
                    )
                    .bind(...params),
                db
                    .prepare(`SELECT count(*) AS total FROM db_activity_log WHERE ${where}`)
                    .bind(...params)
            ]);
            return { data: rows.results.map(logRow), total: Number(count.results[0]?.total ?? 0) };
        } catch (error) {
            throw new DataError(operation, error);
        }
    }

    return {
        async append(entry: ActivityEntry) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_activity_log (actor, action, category, entity_id, summary, details, ip, ip_hash, user_agent)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
                    )
                    .bind(
                        entry.actor,
                        entry.action,
                        entry.category,
                        entry.entityId,
                        entry.summary,
                        entry.details === null ? null : JSON.stringify(entry.details),
                        entry.ip,
                        entry.ipHash,
                        entry.userAgent
                    )
                    .run();
            } catch (error) {
                throw new DataError('activity.append', error);
            }
        },

        list: filter => page(filter, filter.limit, filter.offset, 'activity.list'),

        export: filter => page(filter, 5000, 0, 'activity.export')
    };
}

export function createD1AdminSettingsStore(db: D1Like): AdminSettingsStore {
    return {
        async read(userId: string) {
            try {
                const row = await db
                    .prepare('SELECT settings FROM db_admin_settings WHERE user_id = ?1')
                    .bind(userId)
                    .first<{ settings: string }>();
                return row ? parseJson(row.settings) : null;
            } catch (error) {
                throw new DataError('adminSettings.read', error);
            }
        },

        async write(userId: string, settings: unknown) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_admin_settings (user_id, settings, updated_at) VALUES (?1, ?2, ?3)
                         ON CONFLICT (user_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`
                    )
                    .bind(userId, JSON.stringify(settings), new Date().toISOString())
                    .run();
            } catch (error) {
                throw new DataError('adminSettings.write', error);
            }
        }
    };
}
