import {afterAll, beforeAll, expect, test} from 'bun:test';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const db = new PGlite();
const profileId = '11111111-1111-4111-8111-111111111111';
const first = '22222222-2222-4222-8222-222222222222';
const second = '33333333-3333-4333-8333-333333333333';
const pending = '44444444-4444-4444-8444-444444444444';
const assets = Array.from({length: 8}, (_, index) => ({
  name: `asset-${index}`
}));
const initial = {
  id: profileId,
  revision: 0,
  name: 'Initial',
  username: 'test',
  headline: 'Headline',
  job_title: 'Role',
  bio: 'Bio',
  email: 'test@example.com',
  city: 'City',
  postal_code: '123',
  country: 'Country',
  site_url: 'https://example.com',
  manifest_settings: {display: 'standalone'}
};

async function commit(
  patch: Record<string, unknown>,
  version: string | null = null
) {
  const result = await db.query<{profile: Record<string, any>}>(
    'select public.db_commit_profile_identity($1::jsonb, $2::uuid, $3::jsonb) as profile',
    [JSON.stringify(patch), version, JSON.stringify(version ? assets : [])]
  );
  return result.rows[0].profile;
}

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.db_profiles (
      id uuid primary key default gen_random_uuid(), name text not null, username text not null,
      headline text not null, job_title text not null, bio text not null, avatar text not null,
      email text not null, city text not null, postal_code text not null, country text not null,
      site_url text not null, created_at timestamptz not null default now(), updated_at timestamptz default now()
    );
  `);
  for (const filename of [
    '20260908072558_site_identity_assets.sql',
    '20260913150122_partial_profile_identity.sql',
    '20260927000000_add_profile_pronunciation.sql'
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${filename}`, import.meta.url),
        'utf8'
      )
    );

  await db.exec(`
    create function public.is_admin() returns boolean language sql as 'select false';
    create schema cron;
    create table cron.job(jobid bigint, jobname text);
    create function cron.unschedule(text) returns boolean language sql as 'select true';
    create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';
    create table public.db_experiences(id uuid default gen_random_uuid(), author_id uuid references db_profiles);
    create table public.db_educations(id uuid default gen_random_uuid(), author_id uuid references db_profiles);
    create table public.db_links(id uuid default gen_random_uuid(), author_id uuid references db_profiles);
    create table public.db_categories(id uuid primary key default gen_random_uuid(), author_id uuid references db_profiles);
    create table public.db_items(id uuid default gen_random_uuid(), category_id uuid references db_categories);
    create table public.db_documents(id uuid default gen_random_uuid(), author_id uuid references db_profiles, is_active boolean default true);
    create table public.db_glossary_terms(id uuid default gen_random_uuid(), author_id uuid references db_profiles on delete cascade);
    create table public.db_project_repo_rules(id uuid default gen_random_uuid(), author_id uuid references db_profiles on delete cascade);
    create table public.db_posts(id uuid default gen_random_uuid(), title text);
  `);
  for (const filename of [
    '20260927010000_activity_log.sql',
    '20260927020000_clear_profile_data.sql',
    '20260927074528_repair_admin_profile_tools.sql',
    '20260927125939_activity_log_sort_columns.sql',
    '20260927130647_preserve_pronunciation_format.sql',
    '20260928200000_activity_log_ip.sql'
  ]) {
    const sql = await readFile(
      new URL(`../supabase/migrations/${filename}`, import.meta.url),
      'utf8'
    );
    await db.exec(sql.replace('create extension if not exists pg_cron;', ''));
  }
  await db.exec('grant all on all tables in schema public to service_role');
  await db.query(
    "insert into public.db_identity_versions(id, retired_at) values ($1, now()), ($2, now()), ($3, now() - interval '7 days')",
    [first, second, pending]
  );
}, 30000);

afterAll(async () => {
  await db.close();
});

test('partial RPC and cleanup lifecycle remain atomic in isolated Postgres', async () => {
  let profile = await commit({...initial, id: null}, first);
  const id = profile.id;
  const revision = profile.profile_revision;
  expect(profile.avatar_version).toBe(first);
  expect(profile.avatar).toBe(`https://example.com/avatar.png?v=${first}`);
  const colors = profile.manifest_settings;
  profile = await commit({id, revision, name: 'Changed'});
  expect(profile.name).toBe('Changed');
  expect(profile.email).toBe(initial.email);
  expect(profile.bio).toBe(initial.bio);
  expect(profile.pronunciation).toBeNull();
  profile = await commit({
    id,
    revision: profile.profile_revision,
    pronunciation: '/tʃeɪndʒd/'
  });
  expect(profile.pronunciation).toBe('/tʃeɪndʒd/');
  for (const pronunciation of [' [tʃeɪndʒd] ', 'tʃeɪndʒd', '']) {
    profile = await commit({
      id,
      revision: profile.profile_revision,
      pronunciation
    });
    expect(profile.pronunciation).toBe(pronunciation);
  }
  expect(profile.name).toBe('Changed');
  expect(profile.manifest_settings).toEqual(colors);
  await expect(commit({id, revision, name: 'Stale'}, second)).rejects.toThrow(
    'revision conflict'
  );
  expect(
    (
      await db.query<{profile_id: string | null}>(
        'select profile_id from public.db_identity_versions where id = $1',
        [second]
      )
    ).rows[0].profile_id
  ).toBeNull();
  profile = await commit(
    {
      id,
      revision: profile.profile_revision,
      manifest_settings: {display: 'browser'}
    },
    second
  );
  expect(profile.manifest_settings).toEqual({...colors, display: 'standalone'});
  expect(profile.avatar_version).toBe(second);
  expect(
    (await db.query('select * from public.db_claim_identity_cleanup()')).rows
  ).toEqual([{id: first}]);
  expect(
    (await db.query('select * from public.db_claim_identity_cleanup()')).rows
  ).toEqual([{id: first}]);
  await expect(
    commit({id, revision: profile.profile_revision}, first)
  ).rejects.toThrow('unavailable');
  await db.query('delete from public.db_identity_versions where id = $1', [
    first
  ]);
  expect(
    (await db.query('select * from public.db_claim_identity_cleanup()')).rows
  ).toEqual([]);
  expect(
    (await db.query('select id from public.db_identity_versions order by id'))
      .rows
  ).toEqual([{id: second}, {id: pending}]);
  const permissions = await db.query<{
    anon: boolean;
    authenticated: boolean;
    service: boolean;
  }>(
    `select has_function_privilege('anon', 'public.db_commit_profile_identity(jsonb,uuid,jsonb)', 'EXECUTE') as anon, has_function_privilege('authenticated', 'public.db_claim_identity_cleanup()', 'EXECUTE') as authenticated, has_function_privilege('service_role', 'public.db_claim_identity_cleanup()', 'EXECUTE') as service`
  );
  expect(permissions.rows[0]).toEqual({
    anon: false,
    authenticated: false,
    service: true
  });
  await db.exec('set role anon');
  await expect(
    db.query('select * from public.db_claim_identity_cleanup()')
  ).rejects.toThrow('permission denied');
  await db.exec('reset role');
}, 30000);

test('logs support service-role reads, literal search, stable pages, empty-page totals and matching exports', async () => {
  await db.exec(`set role service_role;
    insert into db_activity_log(actor, action, category, summary, created_at)
    values ('admin@example.com','profile.update','profile','IPA 100% updated', now()),
           ('admin@example.com','auth.login','auth','Signed in', now()),
           ('other@example.com','profile.import','profile','Imported data', now());`);
  const result = async (args = '{}') => {
    const {rows} = await db.query<{
      result: {data: Array<Record<string, string>>; total: number};
    }>(
      `select db_activity_log_list(p_query => ($1::jsonb)->>'query', p_category => ($1::jsonb)->>'category', p_limit => coalesce((($1::jsonb)->>'limit')::int, 10), p_offset => coalesce((($1::jsonb)->>'offset')::int, 0), p_direction => coalesce(($1::jsonb)->>'direction', 'desc')) as result`,
      [args]
    );
    return rows[0].result;
  };
  expect((await result()).total).toBe(3);
  expect((await result('{"query":"IPA"}')).data[0].action).toBe(
    'profile.update'
  );
  expect((await result('{"query":"%"}')).total).toBe(1);
  expect((await result('{"query":"ADMIN@EXAMPLE.COM"}')).total).toBe(2);
  expect((await result('{"category":"profile"}')).total).toBe(2);
  expect(await result('{"offset":100}')).toEqual({data: [], total: 3});
  const ascending = await result('{"direction":"asc"}');
  const descending = await result();
  expect(ascending.data.map(row => row.id)).toEqual(
    descending.data.map(row => row.id).reverse()
  );
  expect((await result('{"limit":1,"offset":1}')).data[0].id).toBe(
    descending.data[1].id
  );
  const exported = await db.query<{result: unknown}>(
    "select db_activity_log_export(p_category => 'profile', p_query => 'IPA') as result"
  );
  expect(exported.rows[0].result).toEqual(
    await result('{"category":"profile","query":"IPA"}')
  );
  await db.exec('reset role');
});

test('every log column sorts across pages and exports with stable ties and null actors last', async () => {
  await db.exec(`begin;
    truncate db_activity_log;
    insert into db_activity_log(id, actor, action, category, summary, ip, created_at) values
      ('00000000-0000-4000-8000-000000000001','Zoe','profile.update','profile','Alpha','10.0.0.1','2026-09-01T00:00:00Z'),
      ('00000000-0000-4000-8000-000000000002','amy','auth.login','auth','Zulu','10.0.0.2','2026-09-02T00:00:00Z'),
      ('00000000-0000-4000-8000-000000000003','AMY','profile.import','profile','beta','10.0.0.3','2026-09-03T00:00:00Z'),
      ('00000000-0000-4000-8000-000000000004',null,'cv.upload','cv','Beta','10.0.0.4','2026-09-03T00:00:00Z');
    set local role service_role;`);
  try {
    const expected = {
      created_at: {asc: [1, 2, 3, 4], desc: [4, 3, 2, 1]},
      category: {asc: [2, 4, 1, 3], desc: [3, 1, 4, 2]},
      action: {asc: [2, 4, 3, 1], desc: [1, 3, 4, 2]},
      actor: {asc: [2, 3, 1, 4], desc: [1, 3, 2, 4]},
      summary: {asc: [1, 3, 4, 2], desc: [2, 4, 3, 1]},
      ip: {asc: [1, 2, 3, 4], desc: [4, 3, 2, 1]}
    };
    for (const [field, directions] of Object.entries(expected)) {
      for (const [direction, ids] of Object.entries(directions)) {
        const pagedIds: number[] = [];
        for (const offset of [0, 2]) {
          const {rows} = await db.query<{
            result: {data: Array<{id: string}>; total: number};
          }>(
            'select db_activity_log_list(p_sort => $1, p_direction => $2, p_limit => 2, p_offset => $3) as result',
            [field, direction, offset]
          );
          expect(rows[0].result.total).toBe(4);
          pagedIds.push(
            ...rows[0].result.data.map(row => Number(row.id.slice(-1)))
          );
        }
        expect(pagedIds).toEqual(ids);
        const {rows} = await db.query<{result: {data: Array<{id: string}>}}>(
          'select db_activity_log_export(p_sort => $1, p_direction => $2) as result',
          [field, direction]
        );
        expect(
          rows[0].result.data.map(row => Number(row.id.slice(-1)))
        ).toEqual(ids);
      }
    }
  } finally {
    await db.exec('rollback');
  }
  await expect(
    db.query("select db_activity_log_list(p_sort => 'unknown')")
  ).rejects.toThrow('Invalid sort field');
  await expect(
    db.query('select db_activity_log_export(p_sort => null)')
  ).rejects.toThrow('Invalid sort field');
});

test('anonymous and authenticated users cannot invoke log or clear RPCs directly', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    for (const query of [
      'select db_activity_log_list()',
      'select db_activity_log_export()',
      `select db_clear_profile_data('${profileId}')`,
      'select * from db_activity_log'
    ])
      await expect(db.query(query)).rejects.toThrow('permission denied');
    await db.exec('reset role');
  }
});

test('export caps at 5000 and pruning removes only logs older than 30 days', async () => {
  await db.exec(
    "insert into db_activity_log(action, category, summary) select 'bulk', 'security', 'fixture' from generate_series(1,5001)"
  );
  const {rows} = await db.query<{result: {data: unknown[]; total: number}}>(
    "select db_activity_log_export(p_category => 'security') as result"
  );
  expect(rows[0].result.total).toBe(5001);
  expect(rows[0].result.data).toHaveLength(5000);
  await db.exec(
    "insert into db_activity_log(action,category,summary,created_at) values ('old','auth','old',now()-interval '31 days'),('recent','auth','recent',now()-interval '29 days')"
  );
  expect(
    (
      await db.query<{removed: number}>(
        'select db_prune_activity_log() as removed'
      )
    ).rows[0].removed
  ).toBe(1);
});

test('clear keeps the profile row and unrelated data while retiring only its resume and assets', async () => {
  const {rows: profiles} = await db.query<{id: string}>(
    'select id from db_profiles limit 1'
  );
  const id = profiles[0].id;
  for (const table of [
    'db_experiences',
    'db_educations',
    'db_links',
    'db_documents',
    'db_glossary_terms',
    'db_project_repo_rules'
  ])
    await db.query(`insert into ${table}(author_id) values ($1)`, [id]);
  await db.query('insert into db_categories(id,author_id) values ($1,$2)', [
    profileId,
    id
  ]);
  await db.query('insert into db_items(category_id) values ($1)', [profileId]);
  await db.exec("insert into db_posts(title) values ('Preserved')");
  await db.exec('set role service_role');
  await db.query('select db_clear_profile_data($1)', [id]);
  await db.exec('reset role');
  const {rows} = await db.query<{
    name: string;
    pronunciation: null;
    avatar_version: null;
  }>(
    'select name, pronunciation, avatar_version from db_profiles where id=$1',
    [id]
  );
  expect(rows[0]).toEqual({
    name: '',
    pronunciation: null,
    avatar_version: null
  });
  for (const table of [
    'db_experiences',
    'db_educations',
    'db_links',
    'db_categories',
    'db_items'
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
  for (const table of [
    'db_posts',
    'db_glossary_terms',
    'db_project_repo_rules'
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
  expect(
    (await db.query<{is_active: boolean}>('select is_active from db_documents'))
      .rows[0].is_active
  ).toBe(false);
  expect(
    (
      await db.query(
        'select * from db_identity_versions where profile_id=$1 and retired_at is null',
        [id]
      )
    ).rows
  ).toHaveLength(0);
  await expect(
    db.query('select db_clear_profile_data($1)', [profileId])
  ).rejects.toThrow('Profile not found');
});
