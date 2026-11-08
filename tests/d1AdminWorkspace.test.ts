// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    createD1AdminActivityStore,
    notificationGroupId
} from '../packages/data/src/d1/adminActivity.ts';
import { DataError } from '../packages/data/src/errors.ts';
import { d1Shim, insertRows } from './support/d1.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (char: string) => char.repeat(64);

function seeded() {
    const shim = d1Shim();
    insertRows(shim.sqlite, 'db_posts', [
        {
            id: uuid(1),
            public_id: hash('a'),
            slug: 'hello',
            title: 'Hello',
            excerpt: 'x',
            published: true,
            storage_path: 'posts/1/a.md',
            created_at: '2026-10-01T00:00:00.000Z'
        },
        {
            id: uuid(2),
            public_id: hash('b'),
            slug: 'second',
            title: 'Zebra',
            excerpt: 'x',
            published: true,
            storage_path: 'posts/2/a.md',
            created_at: '2026-10-01T00:00:00.000Z'
        }
    ]);
    insertRows(shim.sqlite, 'db_legals', [
        { slug: 'privacy', title: 'Privacy', content: '# p' },
        { slug: 'terms', title: 'Terms', content: '# t' }
    ]);
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
            post_id: uuid(2),
            author_name: 'Hidden',
            is_anonymous: true,
            content: 'Rude words',
            created_at: '2026-10-02T11:00:00.000Z'
        },
        {
            id: uuid(13),
            post_id: uuid(2),
            parent_id: uuid(12),
            author_name: 'Admin',
            is_admin: true,
            content: 'Reply here',
            created_at: '2026-10-02T12:00:00.000Z'
        },
        {
            id: uuid(14),
            post_id: uuid(2),
            author_name: 'Cy',
            content: 'Unreported',
            created_at: '2026-10-02T13:00:00.000Z'
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
        },
        {
            id: uuid(24),
            comment_id: uuid(12),
            reason: 'abuse',
            created_at: '2026-10-04T10:00:00.000Z'
        },
        {
            id: uuid(25),
            comment_id: uuid(12),
            reason: 'spam',
            created_at: '2026-10-04T11:00:00.000Z'
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
        },
        {
            id: uuid(34),
            target_type: 'legal',
            target_id: 'gone',
            page_title: 'Removed page',
            vote: 'no',
            ip_hash: hash('4'),
            created_at: '2026-10-05T03:00:00.000Z'
        }
    ]);
    shim.sqlite.run('DELETE FROM db_admin_notifications');
    insertRows(shim.sqlite, 'db_admin_notifications', [
        {
            id: uuid(41),
            kind: 'comment_report',
            post_id: uuid(1),
            comment_id: uuid(11),
            meta: JSON.stringify({ page_title: 'Hello', reason: 'spam', comment: 'Spam link' }),
            created_at: '2026-10-03T10:00:00.000Z'
        },
        {
            id: uuid(42),
            kind: 'comment_report',
            post_id: uuid(1),
            comment_id: uuid(11),
            meta: JSON.stringify({ page_title: 'Hello', reason: 'abuse' }),
            created_at: '2026-10-03T12:00:00.000Z',
            read_at: '2026-10-03T13:00:00.000Z'
        },
        {
            id: uuid(43),
            kind: 'comment_new',
            post_id: uuid(2),
            comment_id: uuid(14),
            meta: JSON.stringify({ page_title: 'Zebra', author: 'Cy' }),
            created_at: '2026-10-04T10:00:00.000Z',
            pinned_at: '2026-10-04T11:00:00.000Z'
        },
        {
            id: uuid(44),
            kind: 'legal_feedback',
            meta: JSON.stringify({ page_id: 'privacy', vote: 'yes', page_title: 'Privacy' }),
            created_at: '2026-10-04T12:00:00.000Z'
        },
        {
            id: uuid(45),
            kind: 'legal_feedback',
            meta: JSON.stringify({ page_id: 'privacy', vote: 'no', page_title: 'Privacy' }),
            created_at: '2026-10-04T13:00:00.000Z'
        },
        {
            id: uuid(46),
            kind: 'post_feedback',
            post_id: uuid(1),
            meta: '{}',
            created_at: '2026-10-04T14:00:00.000Z'
        },
        {
            id: uuid(47),
            kind: 'contact_message',
            meta: JSON.stringify({ details: 'Please call' }),
            created_at: '2026-10-05T10:00:00.000Z'
        },
        {
            id: uuid(48),
            kind: 'contact_message',
            meta: '{}',
            created_at: '2026-10-05T11:00:00.000Z',
            dismissed_at: '2026-10-05T12:00:00.000Z'
        }
    ]);
    return { ...shim, activity: createD1AdminActivityStore(shim.db) };
}

const range = {
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-08T00:00:00.000Z',
    asOf: '2026-10-07T00:00:00.000Z',
    timeZone: 'UTC'
};

type Listing = {
    items: Array<Record<string, any>>;
    total: number;
    page: number;
    [key: string]: any;
};

async function list(
    activity: ReturnType<typeof seeded>['activity'],
    section: string,
    options: Record<string, unknown> = {}
) {
    return (await activity.workspace(section, { ...range, ...options })) as Listing;
}

describe('workspace report groups', () => {
    test('groups, filters, searches and sorts reported comments', async () => {
        const { activity } = seeded();
        const base = await list(activity, 'reports');
        expect(base.total).toBe(2);
        expect(base.items.map(item => item.author).sort()).toEqual(['Ann', 'Anonymous']);

        const byTotal = await list(activity, 'reports', { sort: 'total', direction: 'asc' });
        expect(byTotal.items.map(item => item.total)).toEqual([2, 3]);
        const byPage = await list(activity, 'reports', { sort: 'page' });
        expect(byPage.items.map(item => item.title)).toEqual(['Zebra', 'Hello']);

        expect((await list(activity, 'reports', { reason: 'abuse' })).total).toBe(2);
        expect((await list(activity, 'reports', { postId: uuid(2) })).items[0].id).toBe(uuid(12));
        expect((await list(activity, 'reports', { query: 'zebra' })).total).toBe(1);
        expect((await list(activity, 'reports', { query: 'nothing' })).total).toBe(0);
        const paged = await list(activity, 'reports', { limit: 1, page: 2 });
        expect(paged.items).toHaveLength(1);
        expect(paged.page).toBe(2);
        expect((await list(activity, 'reports', { from: null })).total).toBe(2);
    });

    test('lists a comment report history with reasons and saved notification', async () => {
        const { activity } = seeded();
        const history = await list(activity, 'report_events', {
            id: uuid(11),
            notificationId: uuid(41),
            sort: 'reason'
        });
        expect(history.items).toHaveLength(3);
        expect(history.savedNotification).toMatchObject({ id: uuid(41) });
        expect(history.context).toMatchObject({ id: uuid(11), author: 'Ann', total: 3 });
        expect(history.reasons).toEqual(
            expect.arrayContaining([
                { reason: 'spam', count: 2 },
                { reason: 'abuse', count: 1 }
            ])
        );
        const byDetails = await list(activity, 'report_events', { id: uuid(11), sort: 'details' });
        expect(byDetails.items).toHaveLength(3);
        const focused = await list(activity, 'report_events', { id: uuid(11), focus: uuid(21) });
        expect(focused.items.map(item => item.id)).toEqual([uuid(21)]);
        expect(
            (await list(activity, 'report_events', { id: uuid(11), reason: 'abuse' })).total
        ).toBe(1);
        const anonymous = await list(activity, 'report_events', { id: uuid(12) });
        expect(anonymous.context.author).toBe('Anonymous');
        const missing = await list(activity, 'report_events', { id: uuid(99) });
        expect(missing.context).toBeNull();
        expect(missing.savedNotification).toBeNull();
    });
});

describe('workspace feedback', () => {
    test('groups feedback by page with titles, types and sorts', async () => {
        const { activity } = seeded();
        const base = await list(activity, 'feedback');
        expect(base.total).toBe(3);
        const titles = base.items.map(item => item.title).sort();
        expect(titles).toEqual(['Hello', 'Privacy', 'Removed page']);
        expect(
            (await list(activity, 'feedback', { type: 'legal' })).items.every(
                item => item.targetType === 'legal'
            )
        ).toBe(true);
        expect((await list(activity, 'feedback', { query: 'privacy' })).total).toBe(1);
        expect((await list(activity, 'feedback', { query: 'zzz' })).total).toBe(0);
        expect((await list(activity, 'feedback', { sort: 'total' })).items[0].total).toBe(2);
        expect((await list(activity, 'feedback', { sort: 'helpful' })).items[0].title).toBe(
            'Hello'
        );
        expect(
            (await list(activity, 'feedback', { sort: 'page', direction: 'asc' })).items[0].title
        ).toBe('Hello');
        expect((await list(activity, 'feedback', { from: null })).total).toBe(3);
    });

    test('lists the votes of one page with series and context', async () => {
        const { activity } = seeded();
        const events = await list(activity, 'feedback_events', { id: 'legal:privacy' });
        expect(events.items).toHaveLength(2);
        expect(events.context).toEqual({ title: 'Privacy', id: 'legal:privacy' });
        expect(Array.isArray(events.series)).toBe(true);
        const noMeta = await list(activity, 'feedback_events', {
            id: 'legal:privacy',
            meta: false
        });
        expect(noMeta.series).toBeUndefined();
        const stringMeta = await list(activity, 'feedback_events', {
            id: 'legal:privacy',
            meta: 'false'
        });
        expect(stringMeta.series).toBeUndefined();
        const onlyYes = await list(activity, 'feedback_events', {
            id: 'legal:privacy',
            vote: 'yes'
        });
        expect(onlyYes.items.map(item => item.vote)).toEqual(['yes']);
        const focused = await list(activity, 'feedback_events', {
            id: 'legal:privacy',
            focus: uuid(32)
        });
        expect(focused.items.map(item => item.id)).toEqual([uuid(32)]);
        const seriesOnly = await list(activity, 'feedback_events', {
            id: 'legal:privacy',
            events: false
        });
        expect(seriesOnly.items).toEqual([]);
        expect(seriesOnly.total).toBe(2);
        const missing = await list(activity, 'feedback_events', {
            id: 'legal:nope',
            events: 'false'
        });
        expect(missing.context).toBeNull();
        const missingList = await list(activity, 'feedback_events', { id: 'legal:nope' });
        expect(missingList.context).toBeNull();
    });
});

describe('workspace notifications', () => {
    test('lists notifications with read, type, query and sort options', async () => {
        const { activity } = seeded();
        const base = await list(activity, 'notifications');
        expect(base.total).toBe(7);
        expect(base.items[0].event.pinned_at).not.toBeNull();
        expect(
            (await list(activity, 'notifications', { direction: 'asc' })).items[0].event.pinned_at
        ).not.toBeNull();
        expect((await list(activity, 'notifications', { read: 'read' })).total).toBe(1);
        expect((await list(activity, 'notifications', { read: 'unread' })).total).toBe(6);
        expect((await list(activity, 'notifications', { type: 'helpful' })).total).toBe(1);
        expect((await list(activity, 'notifications', { type: 'unhelpful' })).total).toBe(1);
        expect((await list(activity, 'notifications', { type: 'contact_message' })).total).toBe(1);
        expect((await list(activity, 'notifications', { query: 'call' })).total).toBe(1);
        expect((await list(activity, 'notifications', { sort: 'type' })).total).toBe(7);
        expect((await list(activity, 'notifications', { sort: 'page' })).total).toBe(7);
        expect((await list(activity, 'notifications', { from: null })).total).toBe(7);
    });

    test('lists the events of one notification group', async () => {
        const { activity } = seeded();
        const reportGroup = `["comment_report", "${uuid(11)}", "", "2026-10-03"]`;
        const events = await list(activity, 'notification_events', { id: reportGroup });
        expect(events.items.map(item => item.id).sort()).toEqual([uuid(41), uuid(42)]);
        expect(events.items[0].title).toBe('Hello');
        const focused = await list(activity, 'notification_events', {
            id: reportGroup,
            focus: uuid(41)
        });
        expect(focused.items).toHaveLength(1);
        const feedbackGroup = '["legal_feedback", "privacy", "yes", "2026-10-04"]';
        const feedback = await list(activity, 'notification_events', { id: feedbackGroup });
        expect(feedback.items.map(item => item.id)).toEqual([uuid(44)]);
        const postGroup = `["comment_new", "${uuid(2)}", "", "2026-10-04"]`;
        expect((await list(activity, 'notification_events', { id: postGroup })).total).toBe(1);
        const untitledGroup = `["post_feedback", "${uuid(1)}", "", "2026-10-04"]`;
        const untitled = await list(activity, 'notification_events', { id: untitledGroup });
        expect(untitled.items[0].title).toBe('Notification');
        const nullGroup = '["contact_message", null, "", "2026-10-05"]';
        await list(activity, 'notification_events', { id: nullGroup });
        await expect(list(activity, 'notification_events', { id: '[1,2]' })).rejects.toThrow();
        await expect(list(activity, 'notification_events', { id: 'nope' })).rejects.toThrow();
    });
});

describe('workspace comments and validation', () => {
    test('lists comments of a post and filters reported ones', async () => {
        const { activity } = seeded();
        const all = await list(activity, 'comments', { id: uuid(2) });
        expect(all.total).toBe(3);
        expect(all.items.some(item => item.comment.is_admin)).toBe(true);
        expect(all.items.some(item => item.title === 'Hidden')).toBe(true);
        const reported = await list(activity, 'comments', { id: uuid(2), reason: 'spam' });
        expect(reported.items.map(item => item.id)).toEqual([uuid(12)]);
        const focused = await list(activity, 'comments', { id: uuid(2), focus: uuid(14) });
        expect(focused.items.map(item => item.id)).toEqual([uuid(14)]);
    });

    test('rejects unknown sections and time zones', async () => {
        const { activity } = seeded();
        await expect(activity.workspace('nope', range)).rejects.toThrow(DataError);
        await expect(
            activity.workspace('reports', { ...range, timeZone: 'Mars/Base' })
        ).rejects.toThrow(DataError);
        const summary = (await activity.workspace('summary', {})) as {
            total: number;
            unreadCount: number;
        };
        expect(summary.total).toBe(7);
        expect(summary.unreadCount).toBe(6);
    });
});

describe('inbox validation and ordering', () => {
    const query = {
        query: '',
        type: 'all',
        read: 'all',
        sort: 'date',
        direction: 'desc',
        cursor: null
    };

    test('rejects invalid filters', async () => {
        const { activity } = seeded();
        for (const patch of [
            { query: 'x'.repeat(201) },
            { sort: 'size' },
            { direction: 'up' },
            { read: 'maybe' },
            { type: 'other' }
        ])
            await expect(activity.inbox({ ...query, ...patch } as never)).rejects.toThrow(
                DataError
            );
    });

    test('pages through every sort, direction and read filter', async () => {
        const { activity } = seeded();
        for (const sort of ['date', 'type', 'page'])
            for (const direction of ['asc', 'desc'])
                for (const read of ['all', 'read', 'unread']) {
                    const seen = new Set<string>();
                    let cursor: unknown = null;
                    for (let step = 0; step < 10; step++) {
                        const result = (await activity.inbox({
                            ...query,
                            sort,
                            direction,
                            read,
                            cursor,
                            query: ''
                        } as never)) as { items: Array<{ id: string }>; nextCursor: unknown };
                        for (const item of result.items) seen.add(item.id);
                        cursor = result.nextCursor;
                        if (!cursor) break;
                    }
                    expect(seen.size).toBeGreaterThan(0);
                }
        const searched = (await activity.inbox({ ...query, query: 'zebra' } as never)) as {
            total: number;
        };
        expect(searched.total).toBe(1);
    });
});

describe('group actions and replies', () => {
    const action = {
        id: '["comment_report", "x", "", "2026-10-03"]',
        asOf: '2026-10-07T00:00:00.000Z',
        timeZone: 'UTC',
        remove: false,
        from: null,
        to: null
    };

    test('rejects future, oversized and misconfigured group actions', async () => {
        const { activity } = seeded();
        await expect(
            activity.notificationGroupAction({ ...action, asOf: '2999-01-01T00:00:00.000Z' })
        ).rejects.toThrow(DataError);
        await expect(
            activity.notificationGroupAction({ ...action, id: 'x'.repeat(1501) })
        ).rejects.toThrow(DataError);
        await expect(
            activity.notificationGroupAction({ ...action, timeZone: 'Mars/Base' })
        ).rejects.toThrow(DataError);
    });

    test('marks a ranged group and creates an admin reply', async () => {
        const { activity } = seeded();
        const group = `["comment_report", "${uuid(11)}", "", "2026-10-03"]`;
        expect(
            await activity.notificationGroupAction({
                ...action,
                id: group,
                from: '2026-10-03T09:00:00.000Z',
                to: '2026-10-03T11:00:00.000Z'
            })
        ).toEqual({ affected: 1 });
        const created = (await activity.replyToComment({
            postId: uuid(1),
            parentId: uuid(11),
            authorName: 'Admin',
            content: 'Thanks'
        })) as { status: string; comment: { is_admin: boolean } };
        expect(created.status).toBe('created');
        expect(created.comment.is_admin).toBe(true);
        await activity.dismissReports(uuid(11));
        expect((await list(activity, 'reports')).total).toBe(1);
    });
});

describe('feedback history, ordering and edge cases', () => {
    test('lists the votes of one page and focuses one of them', async () => {
        const { activity } = seeded();
        const page = { type: 'legal', id: 'privacy' };
        const history = (await activity.feedbackHistory({
            offset: 0,
            page,
            focusId: null
        } as never)) as { items: Array<{ id: string }>; total: number; offset: number };
        expect(history.total).toBe(2);
        const focused = (await activity.feedbackHistory({
            offset: 5,
            page,
            focusId: history.items[1].id
        } as never)) as { offset: number };
        expect(focused.offset).toBe(0);
        const missing = (await activity.feedbackHistory({
            offset: 5,
            page,
            focusId: 'absent'
        } as never)) as { offset: number };
        expect(missing.offset).toBe(0);
    });

    test('orders feedback groups with equal timestamps by target', async () => {
        const { activity, sqlite } = seeded();
        const at = '2026-10-06T00:00:00.000Z';
        insertRows(sqlite, 'db_feedback_events', [
            {
                id: uuid(51),
                target_type: 'legal',
                target_id: 'terms',
                page_title: 'Terms',
                vote: 'yes',
                ip_hash: hash('5'),
                created_at: at
            },
            {
                id: uuid(52),
                target_type: 'legal',
                target_id: 'cookies',
                page_title: 'Cookies',
                vote: 'yes',
                ip_hash: hash('6'),
                created_at: at
            },
            {
                id: uuid(53),
                target_type: 'article',
                target_id: uuid(2),
                post_id: uuid(2),
                page_title: 'Zebra',
                vote: 'no',
                ip_hash: hash('7'),
                created_at: at
            }
        ]);
        const groups = (await activity.feedbackGroups({
            offset: 0,
            page: { type: 'legal', id: 'terms' }
        } as never)) as { items: Array<{ target_id: string }> };
        expect(groups.items.slice(0, 3).map(item => item.target_id)).toEqual([
            uuid(2),
            'cookies',
            'terms'
        ]);
    });

    test('pages a large inbox with a cursor under every ordering', async () => {
        const { activity, sqlite } = seeded();
        const kinds = ['contact_message', 'feedback_report', 'comment_new'];
        insertRows(
            sqlite,
            'db_admin_notifications',
            Array.from({ length: 30 }, (_, index) => ({
                kind: kinds[index % kinds.length],
                post_id: index % 2 ? uuid(1) : uuid(2),
                meta: '{}',
                created_at: `2026-10-06T00:${String(Math.floor(index / 2)).padStart(2, '0')}:00.000Z`
            }))
        );
        for (const sort of ['date', 'type', 'page'])
            for (const direction of ['asc', 'desc']) {
                const seen: string[] = [];
                let cursor: unknown = null;
                for (let step = 0; step < 10; step++) {
                    const result = (await activity.inbox({
                        query: '',
                        type: 'all',
                        read: 'all',
                        sort,
                        direction,
                        cursor
                    } as never)) as { items: Array<{ id: string }>; nextCursor: unknown };
                    seen.push(...result.items.map(item => item.id));
                    cursor = result.nextCursor;
                    if (!cursor) break;
                }
                expect(new Set(seen).size).toBe(seen.length);
                expect(seen.length).toBe(37);
            }
    });

    test('groups notifications whose metadata cannot be parsed', () => {
        const base = { kind: 'contact_message', id: 'n1', created_at: '2026-10-03T10:00:00.000Z' };
        expect(notificationGroupId({ ...base, meta: '{broken' }, 'UTC')).toBe(
            '["contact_message", "n1", "", "2026-10-03"]'
        );
        expect(notificationGroupId({ ...base, kind: 'post_feedback', meta: '[1]' }, 'UTC')).toBe(
            '["post_feedback", "n1", "", "2026-10-03"]'
        );
        expect(notificationGroupId({ ...base, meta: null }, 'UTC')).toContain('"n1"');
    });

    test('fails when a stored reply cannot be read back', async () => {
        const shim = seeded();
        const failing = createD1AdminActivityStore({
            ...shim.db,
            prepare: sql => {
                const statement = shim.db.prepare(sql);
                if (!sql.includes('INSERT INTO db_comments')) return statement;
                return { ...statement, bind: () => ({ first: async () => null }) } as never;
            }
        });
        await expect(
            failing.replyToComment({
                postId: uuid(1),
                parentId: uuid(11),
                authorName: 'Admin',
                content: 'x'
            })
        ).rejects.toThrow(DataError);
    });
});
