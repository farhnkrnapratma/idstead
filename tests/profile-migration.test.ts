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
    create role service_role;
    create table public.db_profiles (
      id uuid primary key default gen_random_uuid(), name text not null, username text not null,
      headline text not null, job_title text not null, bio text not null, avatar text not null,
      email text not null, city text not null, postal_code text not null, country text not null,
      site_url text not null, created_at timestamptz not null default now(), updated_at timestamptz default now()
    );
  `);
  for (const filename of [
    '20260908072558_site_identity_assets.sql',
    '20260913150122_partial_profile_identity.sql'
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${filename}`, import.meta.url),
        'utf8'
      )
    );
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
  expect(profile.manifest_settings).toEqual({...colors, display: 'browser'});
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
