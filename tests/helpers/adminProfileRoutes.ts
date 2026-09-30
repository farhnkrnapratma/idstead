import assert from 'node:assert/strict';
import {mock} from 'bun:test';

let authError: Response | null = null;
let logFailure = false;
let clearFailure = false;
let cleanupFailure = false;
let passwordFailure = false;
const calls: string[] = [];
const rpcCalls: Array<{name: string; args: Record<string, unknown>}> = [];
const profile = {
  id: '22222222-2222-4222-8222-222222222222',
  profile_revision: 1,
  name: 'Before',
  pronunciation: '',
  manifest_settings: {display: 'standalone'}
};
const userDb = {
  rpc: async (name: string) => {
    assert.ok(['db_save_cv', 'db_save_skills', 'db_save_links'].includes(name));
    calls.push(`user:${name}`);
    return {error: null};
  }
};
const db = {
  auth: {getUser: async () => ({data: {user: {email: 'fixture@example.com'}}})},
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push(`service:${name}`);
    rpcCalls.push({name, args});
    assert.ok(
      [
        'db_commit_profile_identity',
        'db_clear_all_data',
        'db_activity_log_list',
        'db_activity_log_export'
      ].includes(name)
    );
    return {
      data: {data: [], total: 27},
      error:
        (
          (name === 'db_clear_all_data' && clearFailure)
          || (name.startsWith('db_activity_log') && logFailure)
        ) ?
          {message: 'Fixture failure'}
        : null
    };
  },
  from: (table: string) => {
    const rows =
      table === 'db_profiles' ? [profile]
      : table === 'db_documents' ? [{filename: 'fixture.pdf'}]
      : table === 'db_identity_versions' ? [{id: 'version'}]
      : [];
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      order: () => builder,
      delete: () => {
        calls.push(`delete:${table}`);
        return builder;
      },
      maybeSingle: async () => ({data: rows[0] ?? null, error: null}),
      insert: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        calls.push(`insert:${table}`);
        return {error: null};
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({data: rows, error: null}).then(resolve)
    };
    return builder;
  }
};
mock.module('../../src/lib/server/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => db
}));
mock.module('../../src/lib/server/supabaseUser', () => ({
  getSupabaseUserClient: (request: Request) => {
    assert.equal(request.headers.get('authorization'), 'Bearer fixture');
    return userDb;
  }
}));
mock.module('../../src/lib/server/adminCv', () => ({
  requireAdminAuth: async () => authError,
  deleteCvFile: async () => {
    calls.push('remove:cv');
    return !cleanupFailure;
  }
}));
mock.module('../../src/lib/server/profileAssets', () => ({
  removeAssets: async () => {
    calls.push('remove:avatar');
  }
}));
mock.module('../../src/lib/server/blogPostAuth', () => ({
  blogAdmin: async () =>
    authError ? {status: 401, message: 'Unauthorized'} : {actor: 'fixture'}
}));
mock.module('$lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: async () => ({
        error: passwordFailure ? {message: 'Invalid credentials'} : null
      })
    }
  }
}));
mock.module('../../src/lib/server/blogBannerStorage', () => ({
  cleanupBlogAssets: async () => {
    calls.push('cleanup:blog');
    return {cleanupPending: false, removed: 0};
  }
}));
mock.module('$env/dynamic/private', () => ({env: {}}));

function event(
  path: string,
  body?: unknown,
  origin = 'https://fixture.example'
) {
  const url = new URL(`https://fixture.example/api/internal/admin/${path}`);
  return {
    url,
    request: new Request(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        Authorization: 'Bearer fixture',
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    platform: undefined,
    getClientAddress: () => '192.0.2.1'
  } as never;
}
const {POST: importProfile} =
  await import('../../src/routes/api/internal/admin/profile/import/+server');
const {POST: clearAll} =
  await import('../../src/routes/api/internal/admin/data/delete-all/+server');
const {GET: list} =
  await import('../../src/routes/api/internal/admin/activity-log/+server');
const {GET: exportLog} =
  await import('../../src/routes/api/internal/admin/activity-log/export/+server');

let response = await importProfile(
  event('profile/import', {
    profile: {pronunciation: '/fɑːrˈhɑːn/'},
    cv: {experience: [], education: []},
    skills: [],
    socials: []
  })
);
assert.equal(response.status, 200);
assert.deepEqual((await response.json()).applied, [
  'profile',
  'cv',
  'skills',
  'socials'
]);
assert.ok(calls.includes('user:db_save_cv'));
assert.ok(calls.includes('user:db_save_skills'));
assert.ok(calls.includes('user:db_save_links'));
assert.equal(calls.at(-1), 'insert:db_activity_log');
calls.length = 0;
response = await importProfile(
  event('profile/import', {profile: {name: 'After'}})
);
assert.equal(response.status, 200);
assert.deepEqual((await response.json()).applied, ['profile']);
assert.equal(calls.filter(call => call.startsWith('user:')).length, 0);
for (const [name, payload] of [
  ['cv', {authorId: profile.id, experiences: [], education: []}],
  ['skills', {authorId: profile.id, categories: []}],
  ['links', {authorId: profile.id, category: 'social', items: []}]
] as const) {
  const {POST} = await import(
    `../../src/routes/api/internal/admin/${name}/+server`
  );
  assert.equal((await POST(event(name, payload))).status, 200);
  assert.equal(calls.at(-1), 'insert:db_activity_log');
}
calls.length = 0;
passwordFailure = true;
assert.equal(
  (await clearAll(event('data/delete-all', {password: 'wrong'}))).status,
  401
);
assert.deepEqual(calls, []);
passwordFailure = false;
assert.equal((await clearAll(event('data/delete-all', {}))).status, 400);
clearFailure = true;
calls.length = 0;
assert.equal(
  (await clearAll(event('data/delete-all', {password: 'correct'}))).status,
  503
);
assert.deepEqual(calls, ['service:db_clear_all_data']);
clearFailure = false;
cleanupFailure = true;
calls.length = 0;
response = await clearAll(event('data/delete-all', {password: 'correct'}));
assert.equal(response.status, 503);
assert.equal((await response.json()).code, 'DATA_DELETE_CLEANUP_FAILED');
assert.equal(calls[0], 'service:db_clear_all_data');
cleanupFailure = false;
assert.equal(
  (await clearAll(event('data/delete-all', {password: 'correct'}))).status,
  200
);
assert.equal(
  (
    await clearAll(
      event('data/delete-all', {password: 'correct'}, 'https://evil.example')
    )
  ).status,
  403
);
assert.equal((await list(event('activity-log?offset=100'))).status, 200);
assert.equal((await list(event('activity-log?limit=NaN'))).status, 400);
for (const field of ['created_at', 'category', 'action', 'actor', 'summary']) {
  assert.equal(
    (await list(event(`activity-log?sort=${field}&direction=asc`))).status,
    200
  );
  assert.equal(rpcCalls.at(-1)?.name, 'db_activity_log_list');
  assert.equal(rpcCalls.at(-1)?.args.p_sort, field);
  assert.equal(
    (
      await exportLog(
        event(`activity-log/export?format=txt&sort=${field}&direction=asc`)
      )
    ).status,
    200
  );
  assert.equal(rpcCalls.at(-1)?.name, 'db_activity_log_export');
  assert.equal(rpcCalls.at(-1)?.args.p_sort, field);
  assert.equal(rpcCalls.at(-1)?.args.p_direction, 'asc');
}
for (const path of ['activity-log', 'activity-log/export']) {
  const count = rpcCalls.length;
  assert.equal(
    (
      await (path.endsWith('export') ? exportLog : list)(
        event(`${path}?sort=unknown`)
      )
    ).status,
    400
  );
  assert.equal(rpcCalls.length, count);
}
assert.equal(
  (await exportLog(event('activity-log/export?format=txt'))).headers.get(
    'content-type'
  ),
  'text/plain; charset=utf-8'
);
assert.equal(
  (await exportLog(event('activity-log/export?format=xml'))).status,
  400
);
logFailure = true;
assert.equal((await list(event('activity-log'))).status, 503);
authError = new Response(null, {status: 401});
calls.length = 0;
for (const run of [
  () => importProfile(event('profile/import', {profile: {name: 'No'}})),
  () => clearAll(event('data/delete-all', {password: 'correct'})),
  () => list(event('activity-log')),
  () => exportLog(event('activity-log/export'))
])
  assert.equal((await run()).status, 401);
assert.deepEqual(calls, []);
console.log('Admin profile route regressions passed');
