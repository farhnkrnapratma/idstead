import assert from 'node:assert/strict';
import {mock} from 'bun:test';

let role = 'admin';
let level = 'aal2';
let actor = 'fixture';
const db = {
  from: (table: string) => ({
    insert: async (row: Record<string, unknown>) => {
      assert.equal(table, 'db_activity_log');
      assert.equal(row.action, 'auth.password_update');
      assert.equal(row.details, null);
      return {error: null};
    }
  }),
  auth: {
    getUser: async () => ({
      data: {user: {id: actor, app_metadata: {role}}},
      error: null
    }),
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({
        data: {currentLevel: level, nextLevel: 'aal2'},
        error: null
      })
    }
  }
};
mock.module('../../src/lib/server/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => db
}));
mock.module('$env/dynamic/public', () => ({
  env: {
    PUBLIC_SUPABASE_URL: 'https://auth.example',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-fixture'
  }
}));
const {POST} =
  await import('../../src/routes/api/internal/admin/password/+server');
let updates = 0;
let updateStatus = 200;
let sent: Record<string, string> | null = null;
const password = 'kopi langit kabel zebra malam';

async function run(
  body: unknown = {password, currentPassword: 'old-fixture'},
  origin = 'https://fixture.example',
  token = 'Bearer fixture'
) {
  const url = new URL('https://fixture.example/api/internal/admin/password');
  const request = new Request(url, {
    method: 'POST',
    headers: {
      Origin: origin,
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const fetchFixture = async (input: string, init?: RequestInit) => {
    assert.equal(input, 'https://auth.example/auth/v1/user');
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer fixture'
    );
    assert.equal(new Headers(init?.headers).get('apikey'), 'public-fixture');
    sent = JSON.parse(String(init?.body));
    updates++;
    return Response.json(
      updateStatus === 200 ? {id: actor} : {code: 'current_password_mismatch'},
      {status: updateStatus}
    );
  };
  return POST({request, url, fetch: fetchFixture} as unknown as Parameters<
    typeof POST
  >[0]);
}

assert.equal((await run(undefined, 'https://evil.example')).status, 403);
assert.equal((await run(undefined, undefined, '')).status, 401);
role = 'reader';
assert.equal((await run()).status, 403);
role = 'admin';
level = 'aal1';
assert.equal((await run()).status, 403);
level = 'aal2';
assert.equal(updates, 0);
assert.equal(
  (await run({password: 'short', currentPassword: 'old'})).status,
  400
);
assert.equal((await run({password, currentPassword: ''})).status, 400);
assert.equal((await run({password, currentPassword: password})).status, 400);
assert.equal(
  (await run({password: 'x'.repeat(5000), currentPassword: 'old'})).status,
  400
);
updateStatus = 400;
assert.equal((await run()).status, 400);
updateStatus = 200;
const success = await run();
assert.equal(success.status, 200);
assert.equal(success.headers.get('cache-control'), 'no-store');
assert.deepEqual(sent, {password, current_password: 'old-fixture'});
actor = 'rate-limit-fixture';
updateStatus = 400;
for (let i = 0; i < 5; i++) assert.equal((await run()).status, 400);
const before = updates;
assert.equal((await run()).status, 429);
assert.equal(updates, before);
console.log('Admin password route regressions passed');
