import type { D1Like, D1Row } from './client';
import {
    addDays,
    daySteps,
    hourSteps,
    iso,
    localDate,
    localHourStart,
    localMidnight
} from './time';

const HOUR_MS = 60 * 60 * 1000;
const SLOT = (column: string) =>
    `substr(${column}, 1, 14) || printf('%02d', (CAST(substr(${column}, 15, 2) AS INTEGER) / 15) * 15)`;

function slotInstant(slot: string): number {
    return Date.parse(`${slot}:00.000Z`);
}

async function slotCounts(
    db: D1Like,
    table: string,
    column: string,
    extra: { select?: string; where?: string },
    params: unknown[]
): Promise<D1Row[]> {
    const group = extra.select ? `, ${extra.select}` : '';
    const { results } = await db
        .prepare(
            `SELECT ${SLOT(column)} AS slot${group}, count(*) AS total FROM ${table}
             WHERE ${column} >= ?1 AND ${column} < ?2${extra.where ? ` AND ${extra.where}` : ''}
             GROUP BY slot${group}`
        )
        .bind(...params)
        .all();
    return results;
}

export interface SeriesPoint {
    bucket: string;
    views: number;
    helpful: number;
    unhelpful: number;
    reports: Record<string, number>;
    partial: boolean;
}

export async function analyticsSeries(
    db: D1Like,
    fromIso: string,
    toIso: string,
    timeZone: string,
    target: string | null = null
): Promise<SeriesPoint[]> {
    const from = Date.parse(fromIso);
    const to = Date.parse(toIso);
    const hourly = to - from <= 48 * HOUR_MS;
    const starts =
        hourly ?
            hourSteps(from, to, timeZone)
        :   daySteps(from, to, timeZone).map(day => localMidnight(day, timeZone));
    const points = new Map<number, SeriesPoint>(
        starts.map(start => {
            const end =
                hourly ?
                    start + HOUR_MS
                :   localMidnight(addDays(localDate(start, timeZone), 1), timeZone);
            return [
                start,
                {
                    bucket: iso(start),
                    views: 0,
                    helpful: 0,
                    unhelpful: 0,
                    reports: {},
                    partial: start < from || end > to
                }
            ];
        })
    );
    const bucketOf = (instant: number) =>
        hourly ?
            localHourStart(instant, timeZone)
        :   localMidnight(localDate(instant, timeZone), timeZone);
    const range = [iso(from), iso(to)];
    const [views, feedback, reports] = await Promise.all([
        target ? [] : slotCounts(db, 'db_views', 'viewed_at', {}, range),
        slotCounts(
            db,
            'db_feedback_events',
            'created_at',
            target ?
                { select: 'vote', where: "target_type || ':' || target_id = ?3" }
            :   { select: 'vote' },
            target ? [...range, target] : range
        ),
        target ?
            []
        :   slotCounts(db, 'db_comment_reports', 'created_at', { select: 'reason' }, range)
    ]);
    for (const row of views) {
        const point = points.get(bucketOf(slotInstant(String(row.slot))));
        if (point) point.views += Number(row.total);
    }
    for (const row of feedback) {
        const point = points.get(bucketOf(slotInstant(String(row.slot))));
        if (!point) continue;
        if (row.vote === 'yes') point.helpful += Number(row.total);
        else if (row.vote === 'no') point.unhelpful += Number(row.total);
    }
    for (const row of reports) {
        const point = points.get(bucketOf(slotInstant(String(row.slot))));
        if (!point) continue;
        const reason = String(row.reason);
        point.reports[reason] = (point.reports[reason] ?? 0) + Number(row.total);
    }
    return [...points.values()];
}

export async function viewCalendar(db: D1Like, snapshotIso: string, timeZone: string) {
    const snapshot = Date.parse(snapshotIso);
    const today = localDate(snapshot, timeZone);
    const firstDay = `${today.slice(0, 4)}-01-01`;
    const counts = new Map<string, number>();
    for (const row of await slotCounts(db, 'db_views', 'viewed_at', {}, [
        iso(localMidnight(firstDay, timeZone)),
        snapshotIso
    ])) {
        const day = localDate(slotInstant(String(row.slot)), timeZone);
        counts.set(day, (counts.get(day) ?? 0) + Number(row.total));
    }
    const days: Array<{ date: string; views: number }> = [];
    for (let day = firstDay; day <= today; day = addDays(day, 1))
        days.push({ date: day, views: counts.get(day) ?? 0 });
    return { year: Number(today.slice(0, 4)), today, timeZone, updatedAt: snapshotIso, days };
}

type FeedbackTotal = D1Row & {
    page: string;
    href: string | null;
    total: number;
    helpful: number;
    unhelpful: number;
};

export async function topPages(db: D1Like) {
    const [read, totals, commented, reported] = await db.batch([
        db.prepare(
            `SELECT p.title AS page, '/blog/' || p.slug AS href, count(*) AS value
             FROM db_views v JOIN db_posts p ON p.id = v.post_id
             GROUP BY v.post_id ORDER BY value DESC LIMIT 1`
        ),
        db.prepare(
            `SELECT coalesce(p.title, l.title, f.title) AS page,
                 CASE WHEN p.slug IS NOT NULL THEN '/blog/' || p.slug WHEN l.slug IS NOT NULL THEN '/' || l.slug END AS href,
                 f.total, f.helpful, f.unhelpful
             FROM (
                 SELECT target_type, target_id, max(page_title) AS title, count(*) AS total,
                     sum(vote = 'yes') AS helpful, sum(vote = 'no') AS unhelpful
                 FROM db_feedback_events GROUP BY target_type, target_id HAVING count(*) >= 3
             ) f
             LEFT JOIN db_posts p ON f.target_type = 'article' AND p.id = f.target_id
             LEFT JOIN db_legals l ON f.target_type = 'legal' AND l.slug = f.target_id`
        ),
        db.prepare(
            `SELECT p.title AS page, '/blog/' || p.slug AS href, count(*) AS value
             FROM db_comments c JOIN db_posts p ON p.id = c.post_id
             GROUP BY c.post_id ORDER BY value DESC LIMIT 1`
        ),
        db.prepare(
            `SELECT p.title AS page, '/blog/' || p.slug AS href, count(*) AS value
             FROM db_comment_reports r JOIN db_comments c ON c.id = r.comment_id JOIN db_posts p ON p.id = c.post_id
             GROUP BY c.post_id ORDER BY value DESC LIMIT 1`
        )
    ]);
    const feedback = totals.results as unknown as FeedbackTotal[];
    const best = (score: (row: FeedbackTotal) => number) =>
        feedback.reduce<FeedbackTotal | null>(
            (top, row) => (!top || score(row) > score(top) ? row : top),
            null
        );
    const helpful = best(row => row.helpful / row.total);
    const unhelpful = best(row => row.unhelpful / row.total);
    const responses = best(row => row.total);
    const metric = (name: string, row: D1Row | undefined, value: (row: D1Row) => string) =>
        row ?
            [{ metric: name, page: row.page ?? null, href: row.href ?? null, value: value(row) }]
        :   [];
    return [
        ...metric('Most viewed', read.results[0], row => String(row.value)),
        ...metric(
            'Most helpful',
            helpful ?? undefined,
            row => `${Math.round((Number(row.helpful) / Number(row.total)) * 100)}%`
        ),
        ...metric(
            'Most unhelpful',
            unhelpful ?? undefined,
            row => `${Math.round((Number(row.unhelpful) / Number(row.total)) * 100)}%`
        ),
        ...metric('Most responses', responses ?? undefined, row => String(row.total)),
        ...metric('Most commented', commented.results[0], row => String(row.value)),
        ...metric('Most reported', reported.results[0], row => String(row.value))
    ];
}
