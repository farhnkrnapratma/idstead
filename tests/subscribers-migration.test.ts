import {expect, test, beforeAll, afterAll} from 'bun:test';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const db = new PGlite();

async function value<T = unknown>(sql: string, params: unknown[] = []) {
  const {rows} = await db.query<{value: T}>(`select ${sql} as value`, params);
  return rows[0].value;
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = 'yes' $$;
    create table db_posts(id uuid primary key default gen_random_uuid(), title text not null, slug text, published boolean default true);
  `);
  await db.exec(
    await readFile(
      'supabase/migrations/20260919000000_blog_subscribers.sql',
      'utf8'
    )
  );
  await db.exec(
    await readFile(
      'supabase/migrations/20260919001000_subscriber_unsubscribe_token.sql',
      'utf8'
    )
  );
});

afterAll(async () => {
  await db.close();
});

async function insert(email: string, status = 'pending') {
  const {rows} = await db.query<{id: string}>(
    'insert into db_subscribers(email, status, unsubscribe_token) values ($1,$2,$3) returning id',
    [email, status, crypto.randomUUID().replace(/-/g, '').repeat(2)]
  );
  return rows[0].id;
}

test('email uniqueness is case-insensitive', async () => {
  await insert('reader@example.com');
  expect(insert('READER@example.com')).rejects.toThrow();
});

test('status is constrained to the known lifecycle values', async () => {
  expect(insert('bogus@example.com', 'subscribed')).rejects.toThrow();
});

test('unsubscribe tokens cannot collide', async () => {
  const token = 'f'.repeat(64);
  await db.query(
    'insert into db_subscribers(email, unsubscribe_token) values ($1,$2)',
    ['one@example.com', token]
  );
  expect(
    db.query(
      'insert into db_subscribers(email, unsubscribe_token) values ($1,$2)',
      ['two@example.com', token]
    )
  ).rejects.toThrow();
});

test('confirm token uniqueness ignores rows without a token', async () => {
  await db.query(
    'insert into db_subscribers(email, unsubscribe_token, confirm_token_hash) values ($1,$2,null),($3,$4,null)',
    ['a@example.com', 'a'.repeat(64), 'b@example.com', 'b'.repeat(64)]
  );
  const count = await value<number>(
    '(select count(*)::int from db_subscribers where confirm_token_hash is null)'
  );
  expect(count).toBeGreaterThanOrEqual(2);
});

test('db_posts gains the notified marker, defaulting to null', async () => {
  const {rows} = await db.query<{subscribers_notified_at: string | null}>(
    "insert into db_posts(title, slug) values ('Hello','hello') returning subscribers_notified_at"
  );
  expect(rows[0].subscribers_notified_at).toBeNull();
});

test('subscriber stats require admin privileges', async () => {
  await db.exec(`set test.admin = 'no'`);
  expect(db.query('select public.db_subscriber_stats()')).rejects.toThrow(
    /Admin privileges required/
  );
});

test('subscriber stats count each lifecycle bucket', async () => {
  await db.exec(`set test.admin = 'yes'`);
  await insert('active-one@example.com', 'active');
  await insert('active-two@example.com', 'active');
  await insert('gone@example.com', 'unsubscribed');

  const stats = await value<{
    active: number;
    pending: number;
    unsubscribed: number;
  }>('(public.db_subscriber_stats())');

  expect(stats.active).toBe(2);
  expect(stats.unsubscribed).toBe(1);
  expect(stats.pending).toBeGreaterThan(0);
});
