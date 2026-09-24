import {afterAll, beforeAll, expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {activityDb, activityMigrationSql} from './helpers/adminActivityDb';
import {workspaceOptions} from '../src/lib/server/adminWorkspace';
import {ADMIN_WORKSPACE_PAGE_SIZE} from '../src/lib/adminWorkspace';

let db: PGlite;
const post = '11111111-1111-4111-8111-111111111111';
const options = {
  asOf: '2026-09-14T12:00:00Z',
  from: null,
  to: '2026-09-14T12:00:00Z',
  timeZone: 'UTC'
};
async function query(section: string, extra: Record<string, unknown> = {}) {
  return (
    await db.query<{data: any}>('select db_admin_workspace($1,$2) data', [
      section,
      {...options, ...extra}
    ])
  ).rows[0].data;
}
beforeAll(async () => {
  db = await activityDb();
  await db.exec(await activityMigrationSql());
  for (const name of [
    '20260913144335_scalable_admin_workspace.sql',
    '20260914002736_admin_workspace_pages.sql',
    '20260914062855_admin_calendar_notification_events.sql'
  ]) {
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  }
  await db.query(
    "insert into db_posts(id,title,slug) values($1,'Testing','testing')",
    [post]
  );
  await db.query(
    "insert into db_comments(post_id,author_name,content,created_at) select $1,'Reader','Comment '||i,'2026-09-13' from generate_series(1,41) i",
    [post]
  );
  await db.exec(
    "insert into db_comment_reports(comment_id,reason,created_at) select id,'spam','2026-09-13' from db_comments"
  );
  await db.query(
    "insert into db_feedback_events(target_type,target_id,post_id,page_title,vote,ip_hash,created_at) select 'article',$1::text,$1::uuid,'Testing',case when i%2=0 then 'yes' else 'no' end,repeat('a',64),'2026-09-13' from generate_series(1,41) i",
    [post]
  );
  await db.exec(
    "insert into db_views(viewed_at) values('2025-12-31T18:00:00Z'),('2026-01-01T00:30:00Z'),('2026-09-14T12:00:00Z'),('2024-02-29T12:00:00Z'),('2026-03-08T06:30:00Z'),('2026-03-08T07:30:00Z')"
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

test('calendar uses the local year, daily zero filling and excludes future views', async () => {
  const calendar = await query('calendar', {
    timeZone: 'Asia/Jakarta',
    from: '2026-09-13',
    range: '1d'
  });
  expect(calendar.year).toBe(2026);
  expect(calendar.days[0]).toEqual({date: '2026-01-01', views: 2});
  expect(calendar.days[1]).toEqual({date: '2026-01-02', views: 0});
  expect(calendar.days.at(-1)).toEqual({date: '2026-09-14', views: 0});
  expect(calendar.days).toEqual(
    (await query('calendar', {timeZone: 'Asia/Jakarta', range: '1y'})).days
  );
  const previousYear = await query('calendar', {
    asOf: '2026-01-01T00:00:00Z',
    timeZone: 'America/Los_Angeles'
  });
  expect(previousYear.year).toBe(2025);
  expect(previousYear.today).toBe('2025-12-31');
});

test('calendar retains leap day and groups DST hours into the same local date', async () => {
  const leap = await query('calendar', {asOf: '2024-03-01T00:00:00Z'});
  expect(leap.days.find((d: any) => d.date === '2024-02-29').views).toBe(1);
  const dst = await query('calendar', {timeZone: 'America/New_York'});
  expect(dst.days.find((d: any) => d.date === '2026-03-08').views).toBe(2);
});

test('notifications are individual events with stable pages, metadata and read filters', async () => {
  const first = await query('notifications', {type: 'comment_new'});
  expect(first.total).toBe(41);
  expect(first.items).toHaveLength(20);
  const ids = new Set<string>();
  for (let page = 1; page <= 3; page++) {
    const result = await query('notifications', {type: 'comment_new', page});
    expect(result.items.length).toBe(page === 3 ? 1 : 20);
    for (const row of result.items) {
      expect(ids.has(row.id)).toBe(false);
      expect(row.event.id).toBe(row.id);
      expect(row.event.meta.author).toBe('Reader');
      expect(row.event.page_url).toContain('/blog/testing');
      ids.add(row.id);
    }
  }
  expect(ids.size).toBe(41);
  expect(
    (await query('notifications', {type: 'comment_new', read: 'read'})).total
  ).toBe(0);
  await db.query(
    'update db_admin_notifications set read_at = now() where id=$1',
    [first.items[0].id]
  );
  expect(
    (await query('notifications', {type: 'comment_new', read: 'read'})).total
  ).toBe(1);
  expect(
    (await query('notifications', {type: 'comment_new', read: 'unread'})).total
  ).toBe(40);
  await db.query(
    "insert into db_admin_notifications(kind,meta,created_at) values('comment_new','{}','2026-09-15')"
  );
  expect((await query('notifications', {type: 'comment_new'})).total).toBe(41);
});

test('workspace pages default to ten items and previews to five', () => {
  expect(ADMIN_WORKSPACE_PAGE_SIZE).toBe(10);
  const limit = (query: Record<string, string>) =>
    workspaceOptions(new URLSearchParams({section: 'reports', ...query}))
      .options.limit;
  expect(limit({})).toBe(ADMIN_WORKSPACE_PAGE_SIZE);
  expect(limit({preview: 'true'})).toBe(5);
});

test('the database caps pages at twenty items and preserves totals', async () => {
  const DATABASE_PAGE_SIZE = 20;
  for (const [section, extra] of [
    ['comments', {id: post}],
    ['reports', {}],
    ['feedback_events', {id: `article:${post}`, from: '2026-09-01'}]
  ] as const) {
    const result = await query(section, {...extra, limit: 1000});
    expect(result.items).toHaveLength(DATABASE_PAGE_SIZE);
    expect(result.total).toBe(41);
    expect((await query(section, {...extra, page: 3})).items).toHaveLength(
      41 - DATABASE_PAGE_SIZE * 2
    );
    expect((await query(section, {...extra, page: 4})).items).toHaveLength(0);
  }
});

test('calendar options validate timezone and the database RPC remains private', async () => {
  expect(
    workspaceOptions(
      new URLSearchParams({section: 'calendar', timeZone: 'Asia/Jakarta'})
    ).section
  ).toBe('calendar');
  expect(() =>
    workspaceOptions(
      new URLSearchParams({section: 'calendar', timeZone: 'Bad/Zone'})
    )
  ).toThrow();
  const result = await db.query<{allowed: boolean}>(
    "select has_function_privilege('anon','public.db_admin_workspace(text,jsonb)','execute') as allowed"
  );
  expect(result.rows[0].allowed).toBe(false);
});
