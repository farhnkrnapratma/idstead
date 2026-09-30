import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {encodePng} from '../src/lib/png';
import {iconSizes, makeIco} from '../src/lib/siteIdentity';

let rpcError: {code: string} | null = null;
let committed: Record<string, unknown> | null = null;
let uploadFailed = false;
let removed: string[] = [];
let commits = 0;
let cleanupCalls = 0;
let cleanupFailed = false;
let currentRevision = 0;
let currentAvatar = '';
const database = {
  auth: {getUser: async () => ({data: {user: {id: 'test-admin'}}})},
  from: () => ({
    insert: async () => ({error: null}),
    delete: () => ({eq: async () => ({error: null})}),
    select: () => ({
      eq: (field: string) => ({
        maybeSingle: async () => ({
          data:
            field === 'id' ?
              {
                id: 'profile',
                profile_revision: currentRevision,
                avatar: currentAvatar
              }
            : committed,
          error: null
        })
      })
    })
  }),
  rpc: async () => {
    commits++;
    return {data: {id: 'profile'}, error: rpcError};
  }
};

mock.module('../src/lib/server/adminCv', () => ({
  requireAdminAuth: async () => null
}));
mock.module('../src/lib/server/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => database
}));
mock.module('@sentry/sveltekit', () => ({captureException: () => {}}));
mock.module('../src/lib/server/profileAssets', () => ({
  writeAssets: async () => {
    if (uploadFailed) throw new Error('Storage failed');
    return [];
  },
  removeAssets: async (_platform: unknown, version: string) => {
    removed.push(version);
  },
  cleanupAssets: async () => {
    cleanupCalls++;
    if (cleanupFailed) throw new Error('Cleanup failed');
    return 0;
  }
}));

const {POST} = await import('../src/routes/api/internal/admin/profile/+server');
let counter = 0;

async function save(
  origin: string = 'https://example.com',
  patch: Record<string, unknown> = {},
  includeImage = true
) {
  const files = Object.fromEntries(
    Object.entries(iconSizes).map(([name, size]) => [
      name,
      encodePng(new Uint8Array(size * size * 4), size, size)
    ])
  );
  const ico = makeIco(
    [16, 32, 48].map(size => ({
      size,
      data: encodePng(new Uint8Array(size * size * 4), size, size)
    }))
  );
  const form = new FormData();
  form.set(
    'profile',
    JSON.stringify({
      id: '11111111-1111-4111-8111-111111111111',
      revision: 0,
      name: 'Test',
      username: 'test',
      headline: 'Test',
      job_title: 'Test',
      bio: 'Test',
      email: 'test@example.com',
      city: 'Test',
      postal_code: '123',
      country: 'Test',
      site_url: 'https://example.com',
      manifest_settings: {
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone'
      },
      ...patch
    })
  );
  for (const [name, bytes] of Object.entries(files))
    form.set(name, new Blob([bytes]), name);
  form.set('favicon.ico', new Blob([ico]), 'favicon.ico');
  form.set(
    'vector',
    JSON.stringify([
      {d: 'M 0 0 L 128 0 L 128 128 Z', fill: '#000000', opacity: 1}
    ])
  );
  if (!includeImage) {
    for (const name of [...form.keys()])
      if (name !== 'profile') form.delete(name);
  }
  database.auth.getUser = async () => ({
    data: {user: {id: `test-admin-${counter++}`}}
  });
  const request = new Request(
    'https://example.com/api/internal/admin/profile',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        ...(origin ? {Origin: origin} : {})
      },
      body: form
    }
  );
  return POST({request, url: new URL(request.url)} as Parameters<
    typeof POST
  >[0]);
}

beforeEach(() => {
  rpcError = null;
  committed = null;
  uploadFailed = false;
  removed = [];
  commits = 0;
  cleanupCalls = 0;
  cleanupFailed = false;
  currentRevision = 0;
  currentAvatar = '';
});

describe('profile save failure recovery', () => {
  test('rejects cross-origin input before storage or commit', async () => {
    expect((await save('https://other.example')).status).toBe(403);
    expect(commits).toBe(0);
  });
  test('an upload failure never commits the profile', async () => {
    uploadFailed = true;
    expect((await save()).status).toBe(502);
    expect(commits).toBe(0);
    expect(removed.length).toBe(1);
  });
  test('a definite revision conflict removes the unused new version', async () => {
    rpcError = {code: '40001'};
    expect((await save()).status).toBe(409);
    expect(removed.length).toBe(1);
  });
  test('an ambiguous commit failure preserves the version for reconciliation', async () => {
    rpcError = {code: ''};
    expect((await save()).status).toBe(503);
    expect(removed).toEqual([]);
  });
  test('a committed version is never removed after a lost response', async () => {
    rpcError = {code: ''};
    committed = {id: 'profile', avatar_version: 'committed'};
    expect((await save()).status).toBe(200);
    expect(removed).toEqual([]);
    expect(cleanupCalls).toBe(1);
  });
});

test('cleanup failures report a successful save with pending cleanup', async () => {
  cleanupFailed = true;
  const response = await save();
  expect(response.status).toBe(200);
  expect((await response.json()).cleanupPending).toBe(true);
});
test('stale revisions are rejected before uploading', async () => {
  currentRevision = 2;
  expect((await save()).status).toBe(409);
  expect(commits).toBe(0);
  expect(removed).toEqual([]);
});

test('invalid fields use the details shape consumed by the profile form', async () => {
  const response = await save(undefined, {email: 'invalid'});
  expect(response.status).toBe(400);
  const result = await response.json();
  expect(JSON.parse(result.details).fields.email).toBeTruthy();
  expect(commits).toBe(0);
  expect(removed).toEqual([]);
});

test('profile creation and edits require an uploaded or saved image', async () => {
  for (const patch of [{id: null}, {}]) {
    const response = await save('https://example.com', patch, false);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: 'Profile image is required.'
    });
    expect(commits).toBe(0);
  }
  currentAvatar = 'https://example.com/avatar.png';
  expect((await save('https://example.com', {}, false)).status).toBe(200);
  expect(commits).toBe(1);
});
