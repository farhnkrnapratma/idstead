import {beforeAll, afterAll, test, expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {activityDb, activityMigrationSql} from './helpers/adminActivityDb';
import {
  workspaceOptions,
  adminWorkspace
} from '../src/lib/server/adminWorkspace';
import {analyticsPeriod, zonedMidnight} from '../src/lib/adminAnalytics';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {PGlite} from '@electric-sql/pglite';
let db: PGlite;
const post = '11111111-1111-4111-8111-111111111111';
const comment = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-09-13T12:00:00Z');
const options = {
  from: '2026-09-01T00:00:00Z',
  to: now.toISOString(),
  asOf: now.toISOString(),
  timeZone: 'Asia/Jakarta',
  query: '',
  reason: '',
  type: 'all',
  read: 'all',
  vote: 'all',
  sort: 'date',
  direction: 'desc',
  minimum: 0
};
async function call(section: string, extra: Record<string, unknown> = {}) {
  const r = await db.query<{data: any}>(
    'select db_admin_workspace($1,$2) data',
    [section, {...options, ...extra}]
  );
  return r.rows[0].data;
}
beforeAll(async () => {
  db = await activityDb();
  await db.exec(await activityMigrationSql());
  await db.exec(
    await readFile(
      'supabase/migrations/20260913144335_scalable_admin_workspace.sql',
      'utf8'
    )
  );
  await db.query('insert into db_posts(id,title,slug) values($1,$2,$3)', [
    post,
    '日本語 testing article',
    'testing'
  ]);
  await db.query(
    "insert into db_comments(id,post_id,author_name,content,created_at) values($1,$2,'Adam','A comment','2026-09-01')",
    [comment, post]
  );
  await db.query(
    "insert into db_comment_reports(comment_id,reason,details,created_at) select $1,case when i%2=0 then 'spam' else 'misinformation' end,case when i=91 then 'needle evidence' else 'Long additional details '||i end,'2026-09-12T00:00:00Z'::timestamptz + i * interval '1 second' from generate_series(1,100) i",
    [comment]
  );
  await db.query(
    "insert into db_feedback_events(target_type,target_id,post_id,page_title,vote,ip_hash,created_at) select 'article',$1::text,$1::uuid,'日本語 testing article',case when i%2=0 then 'yes' else 'no' end,repeat('a',64),'2026-09-12T00:00:00Z'::timestamptz + i * interval '1 second' from generate_series(1,100) i",
    [post]
  );
  await db.exec(
    "insert into db_views(viewed_at) values('2026-09-01T00:00:00Z'),('2026-09-12T01:00:00Z'),('2026-09-13T12:00:00Z')"
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
test('case and feedback totals aggregate before pagination', async () => {
  const reports = await call('reports');
  expect(reports.items[0].total).toBe(100);
  const feedback = await call('feedback');
  expect(feedback.items[0].helpful).toBe(50);
  expect(feedback.items[0].unhelpful).toBe(50);
  const grouped = await call('notifications');
  expect(grouped.items.some((r: any) => r.total === 100)).toBe(true);
});
test('cursor traverses all report events without duplicate equal timestamps', async () => {
  const ids = new Set<string>();
  let cursor = null;
  do {
    const data = await call('report_events', {
      id: comment,
      cursor,
      meta: cursor === null
    });
    expect(data.items.length).toBeLessThanOrEqual(20);
    for (const r of data.items) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
    cursor = data.nextCursor;
  } while (cursor);
  expect(ids.size).toBe(100);
});
test('search reaches records beyond the first page and preserves full text', async () => {
  const result = await call('report_events', {id: comment, query: 'needle'});
  expect(result.total).toBe(1);
  expect(result.items[0].details).toBe('needle evidence');
  expect(result.reasons.reduce((n: number, r: any) => n + r.count, 0)).toBe(1);
});
test('analytics use the exact same half-open interval for totals and chart', async () => {
  const result = await call('overview');
  expect(result.reads).toBe(2);
  expect(result.series.reduce((n: number, r: any) => n + r.views, 0)).toBe(
    result.reads
  );
  expect(result.helpful).toBe(50);
  expect(result.series.reduce((n: number, r: any) => n + r.helpful, 0)).toBe(
    result.helpful
  );
  expect(result.reports.length).toBeLessThanOrEqual(5);
});
test('DST and calendar ranges are bounded and use selected time zone', () => {
  expect(zonedMidnight('2026-03-08', 'America/New_York')).toBe(
    '2026-03-08T05:00:00.000Z'
  );
  expect(zonedMidnight('2026-03-09', 'America/New_York')).toBe(
    '2026-03-09T04:00:00.000Z'
  );
  expect(analyticsPeriod('7d', 'Asia/Jakarta', now).from).toBe(
    '2026-09-06T17:00:00.000Z'
  );
  expect(() =>
    analyticsPeriod('custom', 'UTC', now, '2024-01-01', '2026-09-01')
  ).toThrow();
});
test('yearly and DST charts preserve interval sums', async () => {
  const result = await call('overview', {
    from: '2025-09-13T12:00:00Z',
    timeZone: 'America/New_York'
  });
  expect(result.series.length).toBeLessThanOrEqual(366);
  expect(result.series.reduce((n: number, r: any) => n + r.views, 0)).toBe(2);
  const dst = await call('overview', {
    from: '2026-11-01T04:00:00Z',
    to: '2026-11-01T08:00:00Z',
    timeZone: 'America/New_York'
  });
  expect(dst.series).toHaveLength(4);
  expect(new Set(dst.series.map((r: any) => r.bucket)).size).toBe(4);
});
test('filtered feedback history does not change the distribution', async () => {
  const result = await call('feedback_events', {
    id: `article:${post}`,
    vote: 'no'
  });
  expect(result.total).toBe(50);
  expect(result.items.every((r: any) => r.vote === 'no')).toBe(true);
  expect(result.series.reduce((n: number, r: any) => n + r.helpful, 0)).toBe(
    50
  );
});
test('reading and deleting group is idempotent and excludes arrivals after snapshot', async () => {
  const groups = await call('notifications', {type: 'helpful'});
  const id = groups.items[0].id;
  await db.query(
    "insert into db_admin_notifications(kind,post_id,meta,created_at) values('post_feedback',$1,$2,$3)",
    [post, {page_id: post, vote: 'yes'}, '2026-09-12T03:00:00Z']
  );
  const snapshot = '2026-09-12T00:30:00Z';
  for (let i = 0; i < 2; i++)
    await db.query(
      'select db_admin_notification_group_action($1,$2,$3,false)',
      [id, snapshot, 'Asia/Jakarta']
    );
  const rows = await db.query<{total: number}>(
    "select count(*)::int total from db_admin_notifications where kind='post_feedback' and meta->>'vote'='yes' and read_at is null"
  );
  expect(rows.rows[0].total).toBe(1);
  for (let i = 0; i < 2; i++)
    await db.query('select db_admin_notification_group_action($1,$2,$3,true)', [
      id,
      snapshot,
      'Asia/Jakarta'
    ]);
  const after = await call('notifications', {type: 'helpful'});
  expect(after.items[0].total).toBe(1);
  expect((await call('feedback')).items[0].total).toBe(100);
});
test('private RPCs cannot be executed by browser roles', async () => {
  await db.exec('set role anon');
  try {
    await expect(
      db.query("select db_admin_workspace('summary')")
    ).rejects.toThrow('permission denied');
  } finally {
    await db.exec('reset role');
  }
});
test('rejects unbounded analytics and malformed cursor input', () => {
  expect(() =>
    workspaceOptions(
      new URLSearchParams({section: 'overview', range: 'all'}),
      now
    )
  ).toThrow();
  expect(() =>
    workspaceOptions(
      new URLSearchParams({section: 'reports', cursor: 'bad'}),
      now
    )
  ).toThrow();
  expect(() =>
    workspaceOptions(
      new URLSearchParams({section: 'report_events', id: 'bad'}),
      now
    )
  ).toThrow();
  expect(() =>
    workspaceOptions(new URLSearchParams({timeZone: 'wrong'}), now)
  ).toThrow();
});

const endpoint = new URL('https://fixture.test/api/internal/admin/workspace');
function apiDb(role = 'admin') {
  return {
    auth: {
      getUser: async () => ({
        data: {user: {id: post, app_metadata: {role}}},
        error: null
      })
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      const entries = Object.entries(args);
      const result = await db.query<{data: unknown}>(
        `select ${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(',')}) data`,
        entries.map(([, value]) => value)
      );
      return {data: result.rows[0].data, error: null};
    }
  } as unknown as SupabaseClient;
}
test('API authenticates before querying and rejects cross-origin access', async () => {
  for (const [headers, role, status] of [
    [{}, 'admin', 401],
    [{Authorization: 'Bearer fixture'}, 'user', 403],
    [
      {Authorization: 'Bearer fixture', Origin: 'https://external.test'},
      'admin',
      403
    ]
  ] as const) {
    const response = await adminWorkspace({
      request: new Request(endpoint, {headers}),
      url: endpoint,
      db: apiDb(role)
    });
    expect(response.status).toBe(status);
  }
});
test('opaque cursors preserve implicit dates and Unicode sort keys and reject changed filters', async () => {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    section: 'report_events',
    id: comment
  }).toString();
  const response = await adminWorkspace({
    request: new Request(url, {headers: {Authorization: 'Bearer fixture'}}),
    url,
    db: apiDb()
  });
  expect(response.status).toBe(200);
  const first = await response.json();
  expect(first.nextCursor).toBeString();
  url.searchParams.set('cursor', first.nextCursor);
  const later = new Date(Date.now() + 10000);
  const second = workspaceOptions(url.searchParams, later);
  expect(second.options.to).toBe(first.scope.to);
  expect(Date.parse(second.options.asOf)).toBe(Date.parse(first.asOf));
  const decoded = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(first.nextCursor), c => c.charCodeAt(0))
    )
  );
  decoded.cursor.t = '日本語';
  url.searchParams.set(
    'cursor',
    btoa(
      Array.from(new TextEncoder().encode(JSON.stringify(decoded)), byte =>
        String.fromCharCode(byte)
      ).join('')
    )
  );
  expect(workspaceOptions(url.searchParams, later).options.cursor?.t).toBe(
    '日本語'
  );
  url.searchParams.set('reason', 'spam');
  expect(() => workspaceOptions(url.searchParams, later)).toThrow();
  url.searchParams.delete('reason');
  url.searchParams.set('to', '2026-09-12T12:00:00Z');
  expect(() => workspaceOptions(url.searchParams, later)).toThrow();
});
test('feedback distribution is available without retrieving event history', async () => {
  const result = await call('feedback_events', {
    id: `article:${post}`,
    events: false
  });
  expect(result.items).toHaveLength(0);
  expect(result.total).toBe(100);
  expect(
    result.series.reduce((n: number, r: any) => n + r.helpful + r.unhelpful, 0)
  ).toBe(100);
});
test('group actions respect partial-day bounds and preserve source events', async () => {
  const group = (await call('notifications', {type: 'unhelpful'})).items[0];
  await db.query(
    'select db_admin_notification_group_action($1,$2,$3,true,$4,$5)',
    [
      group.id,
      now.toISOString(),
      'Asia/Jakarta',
      '2026-09-12T00:00:00Z',
      '2026-09-12T00:00:20Z'
    ]
  );
  const remaining = (await call('notifications', {type: 'unhelpful'})).items[0];
  expect(remaining.total).toBe(40);
  expect((await call('feedback')).items[0].total).toBe(100);
});
test('resolved report deep links retain their stored notification context', async () => {
  const report = await db.query<{id: string}>(
    "select id from db_comment_reports where details='needle evidence'"
  );
  const notification = await db.query<{id: string}>(
    'select id from db_admin_notifications where source_id=$1',
    [report.rows[0].id]
  );
  await db.query('delete from db_comment_reports where id=$1', [
    report.rows[0].id
  ]);
  const result = await call('report_events', {
    id: comment,
    focus: report.rows[0].id,
    notificationId: notification.rows[0].id
  });
  expect(result.items).toHaveLength(0);
  expect(result.savedNotification.meta.details).toBe('needle evidence');
});
test('comment pagination keeps private data out and deletion includes unloaded descendants', async () => {
  const parent = crypto.randomUUID(),
    child = crypto.randomUUID(),
    grandchild = crypto.randomUUID();
  await db.query(
    'insert into db_comments(id,post_id,parent_id) values($1,$4,null),($2,$4,$1),($3,$4,$2)',
    [parent, child, grandchild, post]
  );
  const result = await call('comments', {
    id: post,
    asOf: new Date().toISOString()
  });
  expect(result.items.length).toBeLessThanOrEqual(20);
  expect(JSON.stringify(result)).not.toContain('ip_hash');
  const removed = await db.query<{data: {deleted: number}}>(
    'select db_admin_delete_comment($1) data',
    [parent]
  );
  expect(removed.rows[0].data.deleted).toBe(3);
  expect(
    (await db.query('select id from db_comments where id=$1', [comment])).rows
  ).toHaveLength(1);
});

test('hourly chart boundaries follow fractional-offset time zones', async () => {
  const result = await call('overview', {
    from: '2026-09-11T18:30:00Z',
    to: '2026-09-11T20:30:00Z',
    timeZone: 'Asia/Kolkata'
  });
  expect(result.series).toHaveLength(2);
  expect(new Date(result.series[0].bucket).toISOString()).toBe(
    '2026-09-11T18:30:00.000Z'
  );
});

test('fractional helpful-rate sorting traverses equal rates without skips or duplicates', async () => {
  await db.exec(
    "insert into db_feedback_events(target_type,target_id,page_title,vote,ip_hash,created_at) select 'legal','ratio-'||i,'Ratio page '||i,case when v=1 then 'yes' else 'no' end,'fixture','2026-09-12' from generate_series(1,35)i cross join generate_series(1,3)v"
  );
  for (const direction of ['asc', 'desc']) {
    let cursor = null;
    const ids = new Set<string>();
    do {
      const result = await call('feedback', {
        query: 'Ratio',
        sort: 'helpful',
        direction,
        cursor
      });
      for (const item of result.items) {
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
      }
      cursor = result.nextCursor;
    } while (cursor);
    expect(ids.size).toBe(35);
  }
});
