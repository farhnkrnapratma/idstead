import {expect, test} from 'bun:test';
import {verifyAdminToken} from '../src/lib/server/adminAuth';

function client(opts: {
  role?: string | null;
  currentLevel?: string | null;
  nextLevel?: string | null;
  levelError?: boolean;
  seenToken?: {value?: string};
}) {
  return {
    auth: {
      getUser: async () => ({
        data:
          opts.role === null ?
            {user: null}
          : {user: {id: 'admin-1', app_metadata: {role: opts.role ?? 'admin'}}},
        error: null
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async (jwt?: string) => {
          if (opts.seenToken) opts.seenToken.value = jwt;
          return opts.levelError ?
              {data: null, error: new Error('unavailable')}
            : {
                data: {
                  currentLevel: opts.currentLevel ?? 'aal1',
                  nextLevel: opts.nextLevel ?? 'aal1'
                },
                error: null
              };
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const request = (token = 'jwt-token') =>
  new Request('https://fkp.my.id/api/internal/admin/posts', {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`}
  });

test('an admin with no enrolled factor is allowed', async () => {
  const auth = await verifyAdminToken(
    request(),
    client({nextLevel: 'aal1', currentLevel: 'aal1'})
  );
  expect(auth.actor).toBe('admin-1');
});

test('an admin who completed the second factor is allowed', async () => {
  const auth = await verifyAdminToken(
    request(),
    client({nextLevel: 'aal2', currentLevel: 'aal2'})
  );
  expect(auth.actor).toBe('admin-1');
});

test('an admin holding only an aal1 token is refused once a factor exists', async () => {
  const auth = await verifyAdminToken(
    request(),
    client({nextLevel: 'aal2', currentLevel: 'aal1'})
  );
  expect(auth.actor).toBeUndefined();
  expect(auth.status).toBe(403);
  expect(auth.message).toMatch(/two-factor/i);
});

test('the assurance level is resolved from the presented token, not local state', async () => {
  const seenToken: {value?: string} = {};
  await verifyAdminToken(request('the-real-token'), client({seenToken}));
  expect(seenToken.value).toBe('the-real-token');
});

test('an unreadable assurance level fails closed', async () => {
  const auth = await verifyAdminToken(request(), client({levelError: true}));
  expect(auth.status).toBe(403);
});

test('a non-admin role is refused before the factor check', async () => {
  const auth = await verifyAdminToken(request(), client({role: 'member'}));
  expect(auth.status).toBe(403);
  expect(auth.message).toMatch(/Admin privileges/i);
});

test('a missing bearer token is refused', async () => {
  const bare = new Request('https://fkp.my.id/api/internal/admin/posts', {
    method: 'POST'
  });
  const auth = await verifyAdminToken(bare, client({}));
  expect(auth.status).toBe(401);
});
