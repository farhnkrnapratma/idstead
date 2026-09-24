import {expect, test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseMailingCommand, submitMailing} from '../src/lib/mailing';
import {requestUnsubscribe} from '../src/lib/server/unsubscribeRequest';

test('mailing commands accept both actions with an optional email', () => {
  for (const action of ['subscribe', 'unsubscribe'] as const) {
    expect(parseMailingCommand(`/mailing ${action}`)).toEqual({
      action,
      email: ''
    });
    expect(parseMailingCommand(`/mailing ${action} example@mail.com`)).toEqual({
      action,
      email: 'example@mail.com'
    });
  }
  expect(
    parseMailingCommand(' /MAILING   SUBSCRIBE   Example@mail.com ')
  ).toEqual({action: 'subscribe', email: 'Example@mail.com'});
  for (const invalid of [
    '/mailing',
    '/mailing delete a@b.com',
    '/mailings subscribe',
    '/mailing subscribed'
  ])
    expect(parseMailingCommand(invalid)).toBeNull();
});

test('mailing client validates before verification and never sends without a token', async () => {
  let verified = 0;
  let sent = 0;
  const verify = async () => {
    verified++;
    return '';
  };
  const request = async () => {
    sent++;
    return Response.json({ok: true});
  };
  for (const email of ['', 'invalid', 'one@mail.com two@mail.com']) {
    await expect(
      submitMailing('subscribe', email, verify, undefined, request)
    ).rejects.toThrow();
  }
  expect(verified).toBe(0);
  await expect(
    submitMailing('subscribe', 'test@mail.com', verify, undefined, request)
  ).rejects.toThrow('Verification failed');
  expect(sent).toBe(0);
});

test('mailing client sends the correct action, propagates failures, and cancels before sending', async () => {
  for (const action of ['subscribe', 'unsubscribe'] as const) {
    const request = async (url: string, init: RequestInit) => {
      expect(url).toBe(
        action === 'subscribe' ?
          '/api/internal/subscribe'
        : '/api/internal/subscribe/unsubscribe-request'
      );
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'test@mail.com',
        turnstileToken: 'verified'
      });
      return Response.json({message: 'Check inbox'});
    };
    expect(
      await submitMailing(
        action,
        ' test@mail.com ',
        async () => 'verified',
        undefined,
        request
      )
    ).toBe('Check inbox');
  }
  await expect(
    submitMailing(
      'unsubscribe',
      'test@mail.com',
      async () => 'verified',
      undefined,
      async () =>
        Response.json(
          {error: {message: 'Email service unavailable'}},
          {status: 503}
        )
    )
  ).rejects.toThrow('Email service unavailable');
  const controller = new AbortController();
  controller.abort();
  await expect(
    submitMailing(
      'subscribe',
      'test@mail.com',
      async () => 'verified',
      controller.signal,
      async () => {
        throw new Error('must not send');
      }
    )
  ).rejects.toHaveProperty('name', 'AbortError');
});

function fixture(status: string | null = 'active') {
  const url = new URL(
    'https://fixture.example/api/internal/subscribe/unsubscribe-request'
  );
  const calls: {email: string; token: string}[] = [];
  let queries = 0;
  const token = 'a'.repeat(64);
  const query = {
    select: () => query,
    eq: (_key: string, value: string) => {
      expect(value).toBe('test@mail.com');
      return query;
    },
    maybeSingle: async () => {
      queries++;
      return {
        data: status ? {status, unsubscribe_token: token} : null,
        error: null
      };
    }
  };
  const db = {
    from: (table: string) => {
      expect(table).toBe('db_subscribers');
      return query;
    }
  } as unknown as SupabaseClient;
  return {
    calls,
    queries: () => queries,
    run: (
      body: unknown = {email: ' TEST@mail.com ', turnstileToken: 'verified'},
      options: {
        origin?: string;
        verified?: boolean;
        sent?: boolean;
        database?: SupabaseClient | null;
      } = {}
    ) =>
      requestUnsubscribe({
        url,
        request: new Request(url, {
          method: 'POST',
          headers: {
            Origin: options.origin ?? url.origin,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }),
        db: options.database === undefined ? db : options.database,
        verify: async token =>
          token === 'verified' && options.verified !== false,
        send: async (email, token) => {
          calls.push({email, token});
          return options.sent !== false;
        }
      })
  };
}

test('unsubscribe request sends only a confirmation link and never writes subscriber state', async () => {
  const active = fixture();
  const response = await active.run();
  expect(response.status).toBe(200);
  expect(active.calls).toEqual([
    {email: 'test@mail.com', token: 'a'.repeat(64)}
  ]);
  const accepted = await response.json();
  for (const state of ['pending', 'unsubscribed', null]) {
    const subscriber = fixture(state);
    expect(await (await subscriber.run()).json()).toEqual(accepted);
    expect(subscriber.calls.length).toBe(state === 'pending' ? 1 : 0);
  }
});

test('unsubscribe request rejects invalid input, cross-origin and failed verification before database access', async () => {
  const target = fixture();
  for (const input of [
    null,
    [],
    {},
    {email: 123},
    {email: 'bad'},
    {email: 'a'.repeat(255) + '@mail.com'}
  ])
    expect((await target.run(input)).status).toBe(400);
  expect(
    (await target.run(undefined, {origin: 'https://other.example'})).status
  ).toBe(403);
  expect((await target.run(undefined, {verified: false})).status).toBe(403);
  expect(target.queries()).toBe(0);
  expect(target.calls).toEqual([]);
});

test('unsubscribe request handles database configuration, query and delivery failures', async () => {
  expect((await fixture().run(undefined, {database: null})).status).toBe(503);
  const failed = fixture();
  const response = await failed.run(undefined, {sent: false});
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe('UNSUBSCRIBE_UNAVAILABLE');
  const database = {
    from: () => {
      throw new Error('Offline');
    }
  } as unknown as SupabaseClient;
  expect((await fixture().run(undefined, {database})).status).toBe(503);
});
