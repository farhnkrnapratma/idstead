import {afterAll, beforeAll, expect, test} from 'bun:test';
import {readdir, readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {activityDb, activityMigrationSql} from './helpers/adminActivityDb';

let db: PGlite;
let commentId = '';
const options = {
  asOf: '2026-09-24T12:00:00Z',
  from: null,
  to: '2026-09-24T12:00:00Z',
  timeZone: 'UTC'
};
async function history(extra: Record<string, unknown>) {
  const result = await db.query<{data: any}>(
    'select db_admin_workspace($1,$2) data',
    ['report_events', {...options, id: commentId, ...extra}]
  );
  return result.rows[0].data.items.map((item: any) => item.reason as string);
}
beforeAll(async () => {
  db = await activityDb();
  await db.exec('alter table db_views add column post_id uuid');
  await db.exec(await activityMigrationSql());
  const prefixes = [
    '20260913144335',
    '20260914002736',
    '20260914062855',
    '20260917120000',
    '20260918120000',
    '20260924130000'
  ];
  const names = (await readdir('supabase/migrations'))
    .filter(name => prefixes.some(prefix => name.startsWith(prefix)))
    .sort();
  for (const name of names)
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  const post = (
    await db.query<{id: string}>(
      "insert into db_posts(title,slug) values('Testing','testing') returning id"
    )
  ).rows[0].id;
  commentId = (
    await db.query<{id: string}>(
      "insert into db_comments(post_id,author_name,content) values($1,'Reader','Hi') returning id",
      [post]
    )
  ).rows[0].id;
  await db.query(
    `insert into db_comment_reports(comment_id,reason,details,created_at) values
      ($1,'spam','Zebra','2026-09-20'),
      ($1,'harassment','Apple','2026-09-21'),
      ($1,'misinformation',null,'2026-09-22')`,
    [commentId]
  );
}, 60000);
afterAll(async () => {
  await db.close();
});

test('report history sorts by date by default and by direction', async () => {
  expect(await history({})).toEqual(['misinformation', 'harassment', 'spam']);
  expect(await history({direction: 'asc'})).toEqual([
    'spam',
    'harassment',
    'misinformation'
  ]);
});

test('report history can sort by reason', async () => {
  expect(await history({sort: 'reason', direction: 'asc'})).toEqual([
    'harassment',
    'misinformation',
    'spam'
  ]);
  expect(await history({sort: 'reason', direction: 'desc'})).toEqual([
    'spam',
    'misinformation',
    'harassment'
  ]);
});

test('report history can sort by details with empty details first', async () => {
  expect(await history({sort: 'details', direction: 'asc'})).toEqual([
    'misinformation',
    'harassment',
    'spam'
  ]);
});
