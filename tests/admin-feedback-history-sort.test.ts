import {afterAll, beforeAll, expect, test} from 'bun:test';
import {readdir, readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {activityDb, activityMigrationSql} from './helpers/adminActivityDb';

let db: PGlite;
let targetId = '';
const options = {
  asOf: '2026-09-24T12:00:00Z',
  from: '2026-09-19T00:00:00Z',
  to: '2026-09-24T12:00:00Z',
  timeZone: 'UTC',
  vote: 'all',
  meta: 'false'
};
async function history(extra: Record<string, unknown>) {
  const result = await db.query<{data: any}>(
    'select db_admin_workspace($1,$2) data',
    ['feedback_events', {...options, id: `article:${targetId}`, ...extra}]
  );
  return result.rows[0].data.items.map((item: any) => item.vote as string);
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
    '20260924130000',
    '20260925000000'
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
  targetId = post;
  await db.query(
    `insert into db_feedback_events(target_type,target_id,page_title,vote,ip_hash,created_at) values
      ('article',$1,'Testing','yes','a','2026-09-20'),
      ('article',$1,'Testing','no','b','2026-09-21'),
      ('article',$1,'Testing','no','c','2026-09-22')`,
    [targetId]
  );
}, 60000);
afterAll(async () => {
  await db.close();
});

test('feedback history sorts by date by default and by direction', async () => {
  expect(await history({})).toEqual(['no', 'no', 'yes']);
  expect(await history({direction: 'asc'})).toEqual(['yes', 'no', 'no']);
});

test('feedback history can sort by response', async () => {
  expect(await history({sort: 'response', direction: 'asc'})).toEqual([
    'no',
    'no',
    'yes'
  ]);
  expect(await history({sort: 'response', direction: 'desc'})).toEqual([
    'yes',
    'no',
    'no'
  ]);
});
