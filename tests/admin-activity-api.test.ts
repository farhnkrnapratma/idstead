import {expect, test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {recordPageFeedback} from '../src/lib/server/pageFeedback';
import {adminActivity} from '../src/lib/server/adminActivity';
import {activityTimestamp, activityTimeZone} from '../src/lib/adminActivity';
const id = '11111111-1111-4111-8111-111111111111';
const operation = '22222222-2222-4222-8222-222222222222';
const url = new URL('https://fixture.example/api/internal/feedback');
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: url.origin,
      ...headers
    },
    body: JSON.stringify(body)
  });
}
const valid = {
  operationId: operation,
  targetType: 'article',
  targetId: id,
  vote: 'yes'
};
function feedback(
  body: unknown = valid,
  options: {
    secret?: string;
    rpc?: (name: string, args: any) => unknown;
    headers?: Record<string, string>;
    legacy?: boolean;
  } = {}
) {
  return recordPageFeedback({
    request: request(body, options.headers),
    url,
    ip: () => '192.0.2.1',
    secret: options.secret ?? 'private-fixture-salt',
    legacy: options.legacy,
    db: {
      rpc:
        options.rpc
        ?? (() => ({data: {recorded: true, replayed: false}, error: null}))
    } as unknown as SupabaseClient
  });
}
test('new feedback accepts only public target identities and server-derived private metadata', async () => {
  let called = false;
  const response = await feedback(
    {...valid, title: 'Forged', ip: 'forged', created_at: '1900-01-01'},
    {
      rpc: (name, args) => {
        called = true;
        expect(name).toBe('db_record_page_feedback');
        expect(Object.keys(args).sort()).toEqual([
          'p_ip_hash',
          'p_operation_id',
          'p_target_id',
          'p_target_type',
          'p_vote'
        ]);
        expect(args.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(args.p_ip_hash).not.toContain('192.0.2.1');
        return {data: {recorded: true, replayed: false}, error: null};
      }
    }
  );
  expect(called).toBe(true);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({recorded: true, replayed: false});
  for (const body of [
    {...valid, operationId: 'bad'},
    {...valid, targetType: 'unknown'},
    {...valid, targetId: 'bad'},
    {...valid, vote: 'maybe'},
    {...valid, targetType: 'legal', targetId: 'admin'},
    null,
    []
  ])
    expect((await feedback(body)).status).toBe(400);
});
test('origin, payload and missing private secret fail before a database write', async () => {
  let calls = 0;
  const rpc = () => {
    calls++;
    throw new Error('Unexpected write');
  };
  expect(
    (await feedback(valid, {headers: {Origin: 'https://other.example'}, rpc}))
      .status
  ).toBe(403);
  expect(
    (await feedback(valid, {headers: {'Sec-Fetch-Site': 'cross-site'}, rpc}))
      .status
  ).toBe(403);
  expect(
    (await feedback({...valid, excessive: 'x'.repeat(4096)}, {rpc})).status
  ).toBe(413);
  expect((await feedback(valid, {secret: '', rpc})).status).toBe(503);
  expect(
    (await feedback(valid, {headers: {'Content-Type': 'text/plain'}, rpc}))
      .status
  ).toBe(415);
  expect(calls).toBe(0);
});
test('replay, limited requests, operation conflicts, missing targets and failures have distinct responses', async () => {
  for (const data of [
    {recorded: true, replayed: true},
    {recorded: false, replayed: false},
    {recorded: false, replayed: true}
  ])
    expect(
      (await feedback(valid, {rpc: () => ({data, error: null})})).status
    ).toBe(200);
  for (const [message, status] of [
    ['FEEDBACK_OPERATION_CONFLICT', 409],
    ['FEEDBACK_TARGET_NOT_FOUND', 404],
    ['database offline', 503]
  ] as const) {
    const response = await feedback(valid, {
      rpc: () => ({error: {message}, data: null})
    });
    expect(response.status).toBe(status);
    expect((await response.text()).includes('database offline')).toBe(false);
  }
  expect(
    (await feedback(valid, {rpc: () => ({data: {}, error: null})})).status
  ).toBe(503);
  expect(
    (
      await feedback(valid, {
        rpc: () => {
          throw new Error('network offline');
        }
      })
    ).status
  ).toBe(503);
});
test('legacy article endpoint retains its body and recorded response contract', async () => {
  const response = await feedback(
    {postId: id, vote: 'no'},
    {
      legacy: true,
      rpc: (_name, args) => {
        expect(args.p_target_id).toBe(id);
        expect(args.p_target_type).toBe('article');
        expect(args.p_operation_id).toMatch(/^[a-f0-9-]{36}$/);
        return {data: {recorded: false, replayed: false}, error: null};
      }
    }
  );
  expect(response.status).toBe(200);
  expect((await response.json()).recorded).toBe(false);
});
test('all admin endpoints authenticate server-side and reject non-admin and cross-origin callers', async () => {
  let rpcCalls = 0;
  for (const inbox of [true, false])
    for (const state of ['missing', 'expired', 'member', 'admin']) {
      const adminUrl = new URL(
        'https://fixture.example/api/internal/admin/activity'
      );
      const db = {
        auth: {
          getUser: () => ({
            data: {
              user:
                state === 'expired' ? null : (
                  {
                    id,
                    app_metadata: {
                      role: state === 'admin' ? 'admin' : 'member'
                    },
                    user_metadata: {role: 'admin'}
                  }
                )
            },
            error: null
          })
        },
        rpc: () => {
          rpcCalls++;
          return {data: {}, error: null};
        }
      } as unknown as SupabaseClient;
      const response = await adminActivity(
        {
          request: new Request(adminUrl, {
            headers:
              state === 'missing' ? {} : {Authorization: 'Bearer fixture'}
          }),
          url: adminUrl,
          db
        },
        inbox
      );
      expect(response.status).toBe(
        state === 'admin' ? 200
        : state === 'member' ? 403
        : 401
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const crossOrigin = await adminActivity(
        {
          request: new Request(adminUrl, {
            headers: {
              Authorization: 'Bearer fixture',
              Origin: 'https://other.example'
            }
          }),
          url: adminUrl,
          db
        },
        inbox
      );
      expect(crossOrigin.status).toBe(403);
    }
  expect(rpcCalls).toBe(2);
});
test('clear operations bind the verified admin and stable operation ID; malformed filters never reach RPC', async () => {
  const adminUrl = new URL(
    'https://fixture.example/api/internal/admin/notifications'
  );
  let calls = 0;
  const db = {
    auth: {
      getUser: () => ({
        data: {user: {id, app_metadata: {role: 'admin'}}},
        error: null
      })
    },
    rpc: (name: string, args: any) => {
      calls++;
      expect(name).toBe('db_admin_clear_notifications');
      expect(args.p_actor_id).toBe(id);
      expect(args.p_operation_id).toBe(operation);
      return {data: {}, error: null};
    }
  } as unknown as SupabaseClient;
  for (const action of ['prepare_clear', 'clear']) {
    const response = await adminActivity(
      {
        request: new Request(adminUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fixture',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            operationId: operation,
            actorId: crypto.randomUUID()
          })
        }),
        url: adminUrl,
        db
      },
      true
    );
    expect(response.status).toBe(200);
  }
  for (const query of [
    'sort=sql',
    'direction=random',
    'read=hidden',
    'type=legal_feedback',
    'cursor=invalid',
    'query=' + 'a'.repeat(201)
  ]) {
    const target = new URL(`${adminUrl}?${query}`);
    expect(
      (
        await adminActivity(
          {
            request: new Request(target, {
              headers: {Authorization: 'Bearer fixture'}
            }),
            url: target,
            db
          },
          true
        )
      ).status
    ).toBe(400);
  }
  expect(calls).toBe(2);
});
test('timestamps keep a full date and event-specific UTC offsets across DST', () => {
  expect(activityTimestamp('2026-09-11T17:30:00Z', 'Asia/Jakarta')).toBe(
    'Sep 12, 2026 12:30 AM'
  );
  expect(activityTimestamp('2026-09-11T17:30:00Z', 'UTC')).toBe(
    'Sep 11, 2026 5:30 PM'
  );
  expect(
    activityTimeZone('2026-01-12T12:30:00Z', 'America/New_York')
  ).toContain('GMT-05:00');
  expect(
    activityTimeZone('2026-09-12T12:30:00Z', 'America/New_York')
  ).toContain('GMT-04:00');
  expect(activityTimestamp('2026-03-08T06:59:00Z', 'America/New_York')).toBe(
    'Mar 8, 2026 1:59 AM'
  );
  expect(activityTimestamp('2026-03-08T07:00:00Z', 'America/New_York')).toBe(
    'Mar 8, 2026 3:00 AM'
  );
});
