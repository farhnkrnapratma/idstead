import {afterAll, beforeAll, expect, test} from 'bun:test';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const db = new PGlite();
const post = '11111111-1111-4111-8111-111111111111';
const comment = '22222222-2222-4222-8222-222222222222';
const dashboard = await readFile(
  'supabase/migrations/20260910000000_admin_dashboard_notifications.sql',
  'utf8'
);
const inbox = await readFile(
  'supabase/migrations/20260910120000_admin_notifications_inbox.sql',
  'utf8'
);

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.is_admin() returns boolean language sql stable as
      $$ select current_setting('test.admin', true) = 'yes' $$;
    create table db_posts(id uuid primary key, title text);
    create table db_comments(id uuid primary key default gen_random_uuid(), post_id uuid references db_posts(id), author_name text, is_anonymous boolean default false, is_admin boolean default false, created_at timestamptz default now());
    create table db_comment_reports(id uuid primary key default gen_random_uuid(), comment_id uuid references db_comments(id), reason text, created_at timestamptz default now());
    create table db_post_feedback(id uuid primary key default gen_random_uuid(), post_id uuid references db_posts(id), vote text, ip_hash text, created_at timestamptz default now());
    alter table db_post_feedback enable row level security;
    grant select on db_post_feedback to authenticated;
    create table db_views(viewed_at timestamptz);
    insert into db_posts values ('${post}', 'Fixture');
    insert into db_comments(id,post_id,author_name) values ('${comment}', '${post}', 'Fixture');
    insert into db_comment_reports(comment_id,reason,created_at) values ('${comment}','spam',now() - interval '2 days'), ('${comment}','harassment',now());
    insert into db_post_feedback(post_id,vote,ip_hash) values ('${post}','yes','private-fixture-hash');
    create publication supabase_realtime;
  `);
  await db.exec(dashboard);
  await db.exec(
    "insert into db_admin_seen(kind,seen_at) values ('comment_reports',now() - interval '1 day')"
  );
  await db.exec(inbox);
}, 30000);
afterAll(() => db.close());

test('backfill preserves history and read states, registers realtime, and is idempotent by source', async () => {
  const {rows} = await db.query<{kind: string; read: boolean}>(
    'select kind, read_at is not null as read from db_admin_notifications order by kind,created_at'
  );
  expect(rows).toEqual([
    {kind: 'comment_new', read: true},
    {kind: 'comment_report', read: true},
    {kind: 'comment_report', read: false},
    {kind: 'post_feedback', read: false}
  ]);
  await db.exec(dashboard);
  await db.exec(inbox);
  expect(
    (await db.query('select * from db_admin_notifications')).rows.length
  ).toBe(4);
  expect(
    (
      await db.query(
        "select tablename from pg_publication_tables where pubname='supabase_realtime'"
      )
    ).rows
  ).toEqual([{tablename: 'db_admin_notifications'}]);
});

test('new comment, report, feedback and delivery events create durable unread notifications', async () => {
  await db.exec(`
    insert into db_comments(post_id,author_name) values ('${post}','New reader');
    insert into db_comments(post_id,is_admin) values ('${post}',true);
    insert into db_comment_reports(comment_id,reason) values ('${comment}','misinformation');
    insert into db_post_feedback(post_id,vote,ip_hash) values ('${post}','no','new-fixture-hash');
    insert into db_admin_notifications(kind) values ('contact_message'),('feedback_report');
  `);
  const {rows} = await db.query<{kind: string; count: number}>(
    'select kind,count(*)::int from db_admin_notifications where read_at is null group by kind order by kind'
  );
  expect(rows).toEqual([
    {kind: 'comment_new', count: 1},
    {kind: 'comment_report', count: 2},
    {kind: 'contact_message', count: 1},
    {kind: 'feedback_report', count: 1},
    {kind: 'post_feedback', count: 2}
  ]);
});

test('admin access works, non-admin access is blocked, and feedback IP hashes stay private', async () => {
  await db.exec("set role authenticated; set test.admin = 'no'");
  expect(
    (await db.query('select id from db_admin_notifications')).rows
  ).toEqual([]);
  expect((await db.query('select id,vote from db_post_feedback')).rows).toEqual(
    []
  );
  await expect(
    db.exec(
      "insert into db_admin_notifications(kind) values ('contact_message')"
    )
  ).rejects.toThrow();
  await db.exec("set test.admin = 'yes'");
  expect(
    (await db.query('select id,vote from db_post_feedback')).rows.length
  ).toBe(2);
  await expect(
    db.query('select ip_hash from db_post_feedback')
  ).rejects.toThrow();
  await db.exec(
    "update db_admin_notifications set read_at=now() where kind='contact_message'"
  );
  expect(
    (
      await db.query(
        "select id from db_admin_notifications where kind='contact_message' and read_at is null"
      )
    ).rows
  ).toEqual([]);
  await db.exec('set role anon');
  await expect(
    db.query('select * from db_admin_notifications')
  ).rejects.toThrow();
  await db.exec('reset role');
});
