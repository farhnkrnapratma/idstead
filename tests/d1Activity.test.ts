import { describe, expect, test } from 'bun:test';
import { createD1BlogRepository } from '../packages/data/src/d1/blog.ts';
import {
    createD1ActivityLog,
    createD1AdminNotifier,
    createD1AdminSettingsStore,
    createD1FeedbackRecorder
} from '../packages/data/src/d1/activity.ts';
import {
    createD1AdminActivityStore,
    notificationGroupId
} from '../packages/data/src/d1/adminActivity.ts';
import { DataError } from '../packages/data/src/errors.ts';
import { activityContract, type ActivitySeed } from './contracts/activity.contract.ts';
import { d1Shim, insertRows, memoryBucket } from './support/d1.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (char: string) => char.repeat(64);

function stores(seed: ActivitySeed) {
    const shim = d1Shim();
    insertRows(
        shim.sqlite,
        'db_posts',
        seed.posts.map(post => ({
            id: post.uuid,
            public_id: post.publicId,
            slug: post.slug,
            title: post.slug,
            excerpt: 'Excerpt',
            published: true,
            storage_path: `posts/${post.uuid}/a.md`,
            created_at: '2026-10-01T00:00:00.000Z'
        }))
    );
    insertRows(
        shim.sqlite,
        'db_legals',
        seed.legalPages.map(slug => ({ slug, title: slug, content: `# ${slug}` }))
    );
    insertRows(
        shim.sqlite,
        'db_admin_notifications',
        seed.notifications.map(item => ({
            id: item.id,
            kind: item.kind === 'helpful' ? 'post_feedback' : item.kind,
            meta: JSON.stringify(item.kind === 'helpful' ? { vote: 'yes' } : {}),
            created_at: item.createdAt,
            read_at: item.read ? item.createdAt : null
        }))
    );
    return {
        ...shim,
        blog: createD1BlogRepository(shim.db, memoryBucket()),
        feedback: createD1FeedbackRecorder(shim.db),
        notifier: createD1AdminNotifier(shim.db),
        activity: createD1AdminActivityStore(shim.db)
    };
}

activityContract('D1 adapter', stores);

const SEED: ActivitySeed = {
    posts: [
        { uuid: uuid(1), publicId: hash('a'), slug: 'hello' },
        { uuid: uuid(2), publicId: hash('b'), slug: 'second' }
    ],
    legalPages: ['privacy', 'terms'],
    notifications: []
};

describe('D1 feedback recorder', () => {
    test('counts a vote once per visitor and day, and moves the post counters', async () => {
        const { blog, feedback, sqlite } = stores(SEED);
        const post = (await blog.getPublishedBySlug('hello'))!;
        const vote = (n: number, value: 'yes' | 'no' = 'yes') => ({
            operationId: uuid(100 + n),
            vote: value,
            ipHash: hash('f')
        });
        expect(await feedback.record({ type: 'article', post }, vote(1))).toEqual({
            status: 'saved',
            recorded: true,
            replayed: false
        });
        expect(await feedback.record({ type: 'article', post }, vote(2, 'no'))).toEqual({
            status: 'saved',
            recorded: false,
            replayed: false
        });
        expect(await feedback.record({ type: 'article', post }, vote(2, 'no'))).toEqual({
            status: 'saved',
            recorded: false,
            replayed: true
        });
        expect(
            sqlite
                .query('select helpful_yes, helpful_no from db_post_stats where post_id = ?')
                .get(uuid(1))
        ).toEqual({ helpful_yes: 1, helpful_no: 0 });
        expect(sqlite.query('select count(*) as n from db_post_feedback').get()).toEqual({ n: 1 });
        expect(
            sqlite
                .query(
                    "select kind, json_extract(meta, '$.vote') as vote from db_admin_notifications"
                )
                .all()
        ).toEqual([{ kind: 'post_feedback', vote: 'yes' }]);
        await expect(
            feedback.record({ type: 'article', post }, { ...vote(3), ipHash: 'bad' })
        ).rejects.toThrow(DataError);
    });
});

describe('D1 activity log and settings', () => {
    test('filters, searches, sorts and pages the log', async () => {
        const { db } = d1Shim();
        const log = createD1ActivityLog(db);
        const entry = (action: string, actor: string | null, category = 'auth') => ({
            actor,
            action,
            category,
            entityId: null,
            summary: `${action} happened`,
            details: { action },
            ip: null,
            ipHash: null,
            userAgent: null
        });
        await log.append(entry('auth.login', 'ada@example.com'));
        await log.append(entry('auth.logout', 'bob@example.com'));
        await log.append(entry('resume.save', null, 'resume'));
        const filter = {
            category: null,
            query: null,
            direction: 'asc' as const,
            sort: 'actor',
            from: null,
            to: null
        };
        const page = await log.list({ ...filter, limit: 2, offset: 0 });
        expect(page.total).toBe(3);
        expect(page.data.map(row => (row as { actor: string | null }).actor)).toEqual([
            'ada@example.com',
            'bob@example.com'
        ]);
        expect((page.data[0] as { details: unknown }).details).toEqual({ action: 'auth.login' });
        expect((await log.export({ ...filter, category: 'resume' })).total).toBe(1);
        expect((await log.export({ ...filter, query: 'LOGOUT' })).total).toBe(1);
        await expect(log.list({ ...filter, sort: 'nope', limit: 10, offset: 0 })).rejects.toThrow(
            DataError
        );
        const settings = createD1AdminSettingsStore(db);
        expect(await settings.read(uuid(9))).toBeNull();
        await settings.write(uuid(9), { theme: 'dark' });
        await settings.write(uuid(9), { theme: 'light' });
        expect(await settings.read(uuid(9))).toEqual({ theme: 'light' });
    });
});

function seededActivity() {
    const shim = stores(SEED);
    insertRows(shim.sqlite, 'db_comments', [
        {
            id: uuid(11),
            post_id: uuid(1),
            author_name: 'Ann',
            content: 'Spam link',
            created_at: '2026-10-02T10:00:00.000Z'
        },
        {
            id: uuid(12),
            post_id: uuid(1),
            parent_id: uuid(11),
            author_name: 'Bob',
            content: 'Reply',
            created_at: '2026-10-02T11:00:00.000Z'
        }
    ]);
    insertRows(shim.sqlite, 'db_comment_reports', [
        {
            id: uuid(21),
            comment_id: uuid(11),
            reason: 'spam',
            created_at: '2026-10-03T10:00:00.000Z'
        },
        {
            id: uuid(22),
            comment_id: uuid(11),
            reason: 'spam',
            created_at: '2026-10-03T11:00:00.000Z'
        },
        {
            id: uuid(23),
            comment_id: uuid(11),
            reason: 'abuse',
            details: 'rude words',
            created_at: '2026-10-03T12:00:00.000Z'
        }
    ]);
    insertRows(shim.sqlite, 'db_feedback_events', [
        {
            id: uuid(31),
            target_type: 'legal',
            target_id: 'privacy',
            page_title: 'privacy',
            vote: 'yes',
            ip_hash: hash('1'),
            created_at: '2026-10-04T23:30:00.000Z'
        },
        {
            id: uuid(32),
            target_type: 'legal',
            target_id: 'privacy',
            page_title: 'privacy',
            vote: 'no',
            ip_hash: hash('2'),
            created_at: '2026-10-05T01:00:00.000Z'
        },
        {
            id: uuid(33),
            target_type: 'article',
            target_id: uuid(1),
            post_id: uuid(1),
            page_title: 'hello',
            vote: 'yes',
            ip_hash: hash('3'),
            created_at: '2026-10-05T02:00:00.000Z'
        }
    ]);
    insertRows(shim.sqlite, 'db_views', [
        { post_id: uuid(1), ip_hash: 'v1', viewed_at: '2026-10-04T16:59:00.000Z' },
        { post_id: uuid(1), ip_hash: 'v2', viewed_at: '2026-10-04T17:00:00.000Z' },
        { post_id: uuid(2), ip_hash: 'v3', viewed_at: '2026-10-05T09:00:00.000Z' }
    ]);
    return shim;
}

describe('D1 admin activity store', () => {
    test('summarises the dashboard and groups feedback and reports', async () => {
        const { activity } = seededActivity();
        expect(await activity.dashboard()).toEqual({
            helpful: 2,
            unhelpful: 1,
            openReports: 3,
            reportedComments: 1,
            published: 2,
            posts: 2
        });
        const groups = (await activity.feedbackGroups({ offset: 0, page: null })) as {
            items: Array<Record<string, unknown>>;
            total: number;
        };
        expect(groups.total).toBe(2);
        expect(groups.items[0]).toMatchObject({
            target_type: 'article',
            helpful: 1,
            page_url: '/blog/hello'
        });
        expect(groups.items[1]).toMatchObject({
            target_id: 'privacy',
            helpful: 1,
            unhelpful: 1,
            page_url: '/privacy'
        });
        const reports = (await activity.reportGroups({
            offset: 0,
            postId: uuid(1),
            focusId: uuid(23)
        })) as { items: Array<Record<string, unknown>> };
        expect(reports.items).toEqual([
            expect.objectContaining({ id: uuid(11), reports: 3, comments: 1, author: 'Ann' })
        ]);
        const history = (await activity.reportHistory({
            commentId: uuid(11),
            reason: null,
            offset: 0,
            focusId: null
        })) as { items: Array<{ id: string }>; reasons: Array<{ reason: string; count: number }> };
        expect(history.items.map(item => item.id)).toEqual([uuid(23), uuid(22), uuid(21)]);
        expect(history.reasons).toEqual([
            expect.objectContaining({ reason: 'abuse', count: 1 }),
            expect.objectContaining({ reason: 'spam', count: 2 })
        ]);
    });

    test('pages the inbox with a cursor and filters by type and read state', async () => {
        const { activity, sqlite } = seededActivity();
        const extra = Array.from({ length: 22 }, (_, i) => ({
            kind: 'contact_message',
            created_at: `2026-10-06T00:${String(i).padStart(2, '0')}:00.000Z`
        }));
        insertRows(sqlite, 'db_admin_notifications', extra);
        const query = {
            query: '',
            type: 'all',
            read: 'all',
            sort: 'date',
            direction: 'desc',
            cursor: null
        };
        const first = (await activity.inbox(query)) as {
            items: Array<{ id: string; type_label: string }>;
            nextCursor: { value: string; date: string; id: string } | null;
            total: number;
            unreadCount: number;
        };
        expect(first.items).toHaveLength(20);
        expect(first.total).toBe(first.unreadCount);
        const second = (await activity.inbox({
            ...query,
            cursor: first.nextCursor
        })) as typeof first;
        expect(second.items.length + 20).toBe(first.total);
        expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(
            first.total
        );
        const reportsOnly = (await activity.inbox({
            ...query,
            type: 'comment_report'
        })) as typeof first;
        expect(reportsOnly.items.map(item => item.type_label)).toEqual([
            'Report',
            'Report',
            'Report'
        ]);
        const helpful = (await activity.inbox({
            ...query,
            type: 'helpful',
            query: 'privacy'
        })) as typeof first;
        expect(helpful.total).toBe(1);
    });

    test('builds workspace sections with time zones and web search', async () => {
        const { activity } = seededActivity();
        const range = {
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-08T00:00:00.000Z',
            asOf: '2026-10-07T00:00:00.000Z',
            timeZone: 'Asia/Jakarta'
        };
        const overview = (await activity.workspace('overview', range)) as {
            series: Array<{ bucket: string; views: number; helpful: number; partial: boolean }>;
            reads: number;
            topPages: Array<{ metric: string; page: string; href?: string; value: string }>;
        };
        expect(overview.reads).toBe(3);
        const byDay = Object.fromEntries(overview.series.map(point => [point.bucket, point]));
        expect(byDay['2026-10-03T17:00:00.000Z'].views).toBe(1);
        expect(byDay['2026-10-04T17:00:00.000Z'].views).toBe(2);
        expect(byDay['2026-10-04T17:00:00.000Z'].helpful).toBe(2);
        expect(overview.series[0].partial).toBe(true);
        expect(overview.topPages[0]).toEqual({
            metric: 'Most viewed',
            page: 'hello',
            href: '/blog/hello',
            value: '2'
        });
        const reports = (await activity.workspace('reports', {
            ...range,
            query: 'spam',
            sort: 'total'
        })) as { items: Array<{ reason: string; total: number }> };
        expect(reports.items).toEqual([expect.objectContaining({ reason: 'spam', total: 3 })]);
        expect(
            (
                (await activity.workspace('reports', { ...range, query: 'spam -link' })) as {
                    total: number;
                }
            ).total
        ).toBe(0);
        const events = (await activity.workspace('report_events', {
            ...range,
            id: uuid(11),
            query: 'rude'
        })) as { items: Array<{ id: string }>; reasons: unknown[]; context: { total: number } };
        expect(events.items.map(item => item.id)).toEqual([uuid(23)]);
        expect(events.reasons).toEqual([{ reason: 'abuse', count: 1 }]);
        expect(events.context.total).toBe(3);
        const calendar = (await activity.workspace('calendar', range)) as {
            year: number;
            days: Array<{ date: string; views: number }>;
        };
        expect(calendar.year).toBe(2026);
        expect(calendar.days.find(day => day.date === '2026-10-05')?.views).toBe(2);
        const comments = (await activity.workspace('comments', { ...range, id: uuid(1) })) as {
            items: Array<{ comment: { is_admin: boolean; reports: number } }>;
        };
        expect(comments.items.map(item => item.comment.reports)).toEqual([0, 3]);
        expect(comments.items[0].comment.is_admin).toBe(false);
        const summary = (await activity.workspace('summary', {})) as {
            total: number;
            revision: string;
        };
        expect(summary.revision.startsWith(`${summary.total}:`)).toBe(true);
    });

    test('marks a notification group read in the viewer time zone, then deletes it', async () => {
        const { activity, sqlite } = seededActivity();
        const rows = sqlite
            .query("select * from db_admin_notifications where kind = 'comment_report'")
            .all() as Array<Record<string, unknown>>;
        const id = notificationGroupId(rows[0], 'Asia/Jakarta');
        expect(id).toBe(`["comment_report", "${uuid(11)}", "", "2026-10-03"]`);
        const action = {
            id,
            asOf: '2026-10-07T00:00:00.000Z',
            timeZone: 'Asia/Jakarta',
            remove: false,
            from: null,
            to: null
        };
        expect(await activity.notificationGroupAction(action)).toEqual({ affected: 3 });
        expect(await activity.notificationGroupAction(action)).toEqual({ affected: 0 });
        expect(await activity.notificationGroupAction({ ...action, remove: true })).toEqual({
            affected: 3
        });
    });

    test('clears read notifications in two steps and deletes comment threads', async () => {
        const { activity, notifier } = seededActivity();
        await notifier.notify('feedback_report');
        expect(await activity.markAllRead()).toBeGreaterThan(0);
        const input = { actorId: uuid(90), operationId: uuid(91), confirm: false };
        expect(await activity.clearNotifications({ ...input, confirm: true })).toEqual({
            status: 'conflict'
        });
        const prepared = (await activity.clearNotifications(input)) as {
            status: string;
            result: { count: number };
        };
        expect(prepared.result.count).toBeGreaterThan(0);
        expect(await activity.clearNotifications({ ...input, actorId: uuid(92) })).toEqual({
            status: 'conflict'
        });
        const done = (await activity.clearNotifications({ ...input, confirm: true })) as {
            result: { completed: boolean; deletedCount: number; count: number };
        };
        expect(done.result).toMatchObject({ completed: true, deletedCount: prepared.result.count });
        expect(await activity.deleteComment(uuid(11))).toEqual({ deleted: 2 });
        const reply = await activity.replyToComment({
            postId: uuid(1),
            parentId: uuid(11),
            authorName: 'Admin',
            content: 'x'
        });
        expect(reply).toEqual({ status: 'invalid-parent' });
        expect(await activity.subscriberStats()).toEqual({
            active: 0,
            pending: 0,
            unsubscribed: 0
        });
    });
});
