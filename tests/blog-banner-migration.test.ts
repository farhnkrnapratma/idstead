import {afterAll, beforeAll, expect, test} from 'bun:test';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const db = new PGlite();
const actor = '11111111-1111-4111-8111-111111111111';
const post = '22222222-2222-4222-8222-222222222222';
const first = '33333333-3333-4333-8333-333333333333';
const second = '44444444-4444-4444-8444-444444444444';
const initial = {
  title: 'Fixture',
  slug: 'fixture',
  excerpt: null,
  published: false,
  tags: [],
  collaborators: [],
  banner_references: []
};

async function prepare(
  id: string,
  revision: number | null,
  operation = 'replace',
  data = initial,
  kind = 'save',
  postId = post,
  hash = 'a'.repeat(64)
) {
  return (
    await db.query<{op: any}>(
      'select public.db_prepare_post_operation($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) op',
      [
        id,
        actor,
        postId,
        hash,
        revision,
        kind,
        JSON.stringify(data),
        JSON.stringify({operation, sha256: 'b'.repeat(64), bytes: 1000})
      ]
    )
  ).rows[0].op;
}
async function commit(id: string) {
  await db.query('select public.db_ready_post_operation($1,$2)', [id, actor]);
  return (
    await db.query<{op: any}>(
      'select public.db_commit_post_operation($1,$2) op',
      [id, actor]
    )
  ).rows[0].op;
}
async function versions() {
  return (
    await db.query<{id: string; state: string}>(
      'select id,state from public.db_blog_banner_versions order by id'
    )
  ).rows;
}

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.db_posts(id uuid primary key, title text not null, slug text unique not null, excerpt text, tags text[], collaborators text[], published boolean not null default false, pinned boolean not null default false, storage_path text, banner_path text, summary text, tldr text[], created_at timestamptz default now(), updated_at timestamptz default now(), views integer default 0);
    create table public.db_post_translations(id uuid primary key default gen_random_uuid(), post_id uuid references public.db_posts(id) on delete cascade, storage_path text);
  `);
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/20260909155951_blog_banner_versions.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
}, 30000);
afterAll(() => db.close());

test('draft, publish, immutable versions, revision conflict, lost response, remove and delete commit atomically', async () => {
  expect((await prepare(first, null)).state).toBe('pending');
  await expect(
    db.query('select public.db_commit_post_operation($1,$2)', [first, actor])
  ).rejects.toThrow('Upload not confirmed');
  expect((await versions())[0].state).toBe('pending');
  const saved = await commit(first);
  expect(saved.result).toMatchObject({
    id: post,
    post_revision: 1,
    banner_version: first,
    published: false
  });
  expect(await commit(first)).toEqual(saved);
  expect((await prepare(first, null)).result).toEqual(saved.result);
  await expect(
    prepare(first, null, 'replace', initial, 'save', post, 'c'.repeat(64))
  ).rejects.toThrow('Operation ID already used');
  const stale = crypto.randomUUID();
  expect((await prepare(stale, 0)).state).toBe('conflict');
  expect((await versions()).length).toBe(1);
  await prepare(second, 1, 'replace', {
    ...initial,
    slug: 'renamed',
    published: true
  });
  const published = await commit(second);
  expect(published.result).toMatchObject({
    post_revision: 2,
    banner_version: second,
    slug: 'renamed',
    published: true
  });
  expect(await versions()).toEqual([
    {id: first, state: 'retired'},
    {id: second, state: 'active'}
  ]);
  expect(
    (await db.query('select * from public.db_claim_blog_banner_cleanup()')).rows
  ).toEqual([]);
  const racing = crypto.randomUUID();
  await prepare(racing, 2);
  await db.query('update public.db_posts set pinned = true where id = $1', [
    post
  ]);
  expect((await commit(racing)).state).toBe('conflict');
  expect(
    (
      await db.query<{banner_version: string}>(
        'select banner_version from public.db_posts'
      )
    ).rows[0].banner_version
  ).toBe(second);
  const remove = crypto.randomUUID();
  await prepare(remove, 3, 'remove');
  expect((await commit(remove)).result).toMatchObject({
    post_revision: 4,
    banner_version: null
  });
  const deletion = crypto.randomUUID();
  await prepare(deletion, 4, 'keep', initial, 'delete');
  expect((await commit(deletion)).result).toEqual({id: post, deleted: true});
  expect((await db.query('select * from public.db_posts')).rows).toEqual([]);
  expect((await commit(deletion)).result.deleted).toBe(true);
}, 30000);

test('cleanup never claims pending, staged, retained or referenced versions; claims are retryable', async () => {
  await db.exec(
    "update public.db_blog_banner_versions set retired_at = now() - interval '2 days'"
  );
  await db.query(
    'update public.db_blog_banner_versions set retain = true where id = $1',
    [first]
  );
  const pending = crypto.randomUUID();
  const staged = crypto.randomUUID();
  for (const [id, state] of [
    [pending, 'pending'],
    [staged, 'staged']
  ])
    await db.query(
      "insert into public.db_blog_banner_versions(id,post_id,object_key,sha256,bytes,state,retired_at) values ($1,$2,$3,$4,100,$5,now()-interval '2 days')",
      [id, post, `blog/banners/${post}/${id}.webp`, 'a'.repeat(64), state]
    );
  const referencePost = crypto.randomUUID();
  await db.query(
    "insert into public.db_posts(id,title,slug) values ($1,'Reference','reference')",
    [referencePost]
  );
  await db.query(
    'insert into public.db_blog_banner_references values ($1,$2)',
    [referencePost, second]
  );
  const claimed = (
    await db.query<{id: string}>(
      'select * from public.db_claim_blog_banner_cleanup()'
    )
  ).rows;
  expect(
    claimed.some(row => [first, second, pending, staged].includes(row.id))
  ).toBe(false);
  expect(
    (await db.query('select * from public.db_claim_blog_banner_cleanup()')).rows
      .length
  ).toBe(claimed.length);
});

test('schema preserves legacy banner references during preparation and blocks public RPC access', async () => {
  const id = crypto.randomUUID();
  await db.query(
    "insert into public.db_posts(id,title,slug,banner_path) values ($1,'Old','old','banners/old.png')",
    [id]
  );
  expect(
    (
      await db.query<{banner_path: string; banner_version: string | null}>(
        'select banner_path,banner_version from public.db_posts where id=$1',
        [id]
      )
    ).rows[0]
  ).toEqual({banner_path: 'banners/old.png', banner_version: null});
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await expect(
      db.query('select public.db_commit_post_operation($1,$2)', [first, actor])
    ).rejects.toThrow('permission denied');
    await expect(
      db.query('select * from public.db_post_operations')
    ).rejects.toThrow('permission denied');
    await db.exec('reset role');
  }
});

test('migration activation verifies every source atomically, preserves old Production paths, and is resumable', async () => {
  const inventory = (
    await db.query<any>(
      'select id,slug,published,banner_path,storage_path,updated_at from public.db_posts order by id'
    )
  ).rows;
  const legacy = inventory.find(row => row.banner_path);
  const version = crypto.randomUUID();
  const orphan = crypto.randomUUID();
  const sources = [
    {
      path: legacy.banner_path,
      version,
      output: {
        key: `blog/banners/${legacy.id}/${version}.webp`,
        sha256: 'a'.repeat(64),
        bytes: 100
      }
    },
    {
      path: 'banners/orphan.webp',
      version: orphan,
      output: {
        key: `blog/banners/${post}/${orphan}.webp`,
        sha256: 'b'.repeat(64),
        bytes: 100
      }
    }
  ];
  const activate = () =>
    db.query('select public.db_activate_blog_banner_migration($1,$2)', [
      JSON.stringify(inventory),
      JSON.stringify(sources)
    ]);
  await expect(activate()).rejects.toThrow('not been verified');
  for (const source of sources)
    await db.query(
      "insert into public.db_blog_banner_versions(id,post_id,object_key,sha256,bytes,state) values ($1,$2,$3,$4,100,'staged')",
      [
        source.version,
        source === sources[0] ? legacy.id : post,
        source.output.key,
        source.output.sha256
      ]
    );
  await activate();
  await activate();
  expect(
    (
      await db.query<any>(
        'select banner_path,banner_version from public.db_posts where id=$1',
        [legacy.id]
      )
    ).rows[0]
  ).toEqual({banner_path: legacy.banner_path, banner_version: version});
  expect(
    (
      await db.query<any>(
        'select state,retain from public.db_blog_banner_versions where id=$1',
        [orphan]
      )
    ).rows[0]
  ).toEqual({state: 'active', retain: true});
  await db.query('select public.db_finalize_blog_banner_migration($1)', [
    JSON.stringify(sources)
  ]);
  expect(
    (
      await db.query<any>(
        'select banner_path from public.db_posts where id=$1',
        [legacy.id]
      )
    ).rows[0].banner_path
  ).toBeNull();
  await db.query('select public.db_finalize_blog_banner_migration($1)', [
    JSON.stringify(sources)
  ]);
});
