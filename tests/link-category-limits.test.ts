import {afterAll, beforeAll, expect, test} from 'bun:test';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const author = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

function items(count: number) {
  return Array.from({length: count}, (_, index) => ({
    platform: `Platform ${index}`,
    url: `https://example.com/${index}`
  }));
}

async function migration(filename: string) {
  return readFile(
    new URL(`../supabase/migrations/${filename}`, import.meta.url),
    'utf8'
  );
}

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create function public.is_admin() returns boolean language sql as $$ select true $$;
    create table public.db_links (
      id uuid primary key default gen_random_uuid(),
      author_id uuid not null,
      category text not null,
      platform text,
      display_value text,
      url text,
      icon text,
      description text,
      sort_order integer
    );
  `);
  await db.exec(
    await migration('20260825010000_fix_db_save_links_signature.sql')
  );
  return db;
}

async function save(db: PGlite, category: string, count: number, id = author) {
  await db.query('select public.db_save_links($1::uuid, $2, $3::jsonb)', [
    id,
    category,
    JSON.stringify(items(count))
  ]);
}

async function total(db: PGlite, category: string, id = author) {
  const result = await db.query<{count: number}>(
    'select count(*)::int as count from public.db_links where author_id = $1 and category = $2',
    [id, category]
  );
  return result.rows[0].count;
}

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  await db.exec(await migration('20260913141942_link_category_limits.sql'));
});

afterAll(async () => {
  await db.close();
});

test('saving exactly the limit succeeds for every capped category', async () => {
  await save(db, 'contact', 10);
  await save(db, 'funding', 10);
  await save(db, 'social', 6);
  expect(await total(db, 'contact')).toBe(10);
  expect(await total(db, 'funding')).toBe(10);
  expect(await total(db, 'social')).toBe(6);
});

test('the RPC rejects one link over the limit and keeps the saved set', async () => {
  await expect(save(db, 'funding', 11)).rejects.toThrow(
    'LINK_CATEGORY_LIMIT: funding allows at most 10 links'
  );
  await expect(save(db, 'social', 7)).rejects.toThrow(
    'LINK_CATEGORY_LIMIT: social allows at most 6 links'
  );
  expect(await total(db, 'funding')).toBe(10);
  expect(await total(db, 'social')).toBe(6);
});

test('a direct insert past the limit is rejected at commit', async () => {
  await expect(
    db.transaction(async tx => {
      await tx.query(
        "insert into public.db_links (author_id, category, platform, url) values ($1, 'contact', 'Extra', 'https://example.com/extra')",
        [author]
      );
    })
  ).rejects.toThrow('LINK_CATEGORY_LIMIT: contact allows at most 10 links');
  expect(await total(db, 'contact')).toBe(10);
});

test('limits apply per author and leave uncapped categories alone', async () => {
  await save(db, 'social', 6, other);
  expect(await total(db, 'social', other)).toBe(6);
  await save(db, 'other', 25);
  expect(await total(db, 'other')).toBe(25);
});

test('the migration refuses to apply over existing data that breaks a limit', async () => {
  const fresh = await createDatabase();
  await fresh.exec(`
    insert into public.db_links (author_id, category, platform, url)
    select '${author}', 'social', 'Platform ' || n, 'https://example.com/' || n
    from generate_series(1, 7) as n;
  `);
  await expect(
    fresh.exec(await migration('20260913141942_link_category_limits.sql'))
  ).rejects.toThrow('LINK_CATEGORY_LIMIT');
  await fresh.close();
});
