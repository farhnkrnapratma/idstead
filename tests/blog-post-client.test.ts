import {expect, test} from 'bun:test';
import {submitPost, PostSaveError} from '../src/lib/postSaveClient';

test('an expired session preserves the operation for reconciliation after login', async () => {
  const original = globalThis.fetch;
  const form = new FormData();
  form.set('post', JSON.stringify({operationId: crypto.randomUUID()}));
  globalThis.fetch = (() =>
    Promise.resolve(
      Response.json({message: 'Session expired'}, {status: 401})
    )) as unknown as typeof fetch;
  try {
    await expect(submitPost(form, 'expired')).rejects.toMatchObject({
      message: 'Session expired',
      definitive: false
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('a lost response resolves committed operations and preserves uncertain operations', async () => {
  const original = globalThis.fetch;
  const form = new FormData();
  const operationId = crypto.randomUUID();
  form.set('post', JSON.stringify({operationId}));
  let state = 'committed';
  let checked = '';
  globalThis.fetch = ((url: string, options?: RequestInit) => {
    if (options?.method === 'POST')
      return Promise.reject(new Error('Connection lost'));
    checked = url;
    return Promise.resolve(
      Response.json({state, post: {id: 'fixture', post_revision: 2}})
    );
  }) as typeof fetch;
  try {
    expect((await submitPost(form, 'fixture')).post.post_revision).toBe(2);
    expect(checked).toContain(operationId);
    state = 'ready';
    await expect(submitPost(form, 'fixture')).rejects.toMatchObject({
      definitive: false
    });
    state = 'conflict';
    await expect(submitPost(form, 'fixture')).rejects.toBeInstanceOf(
      PostSaveError
    );
    await expect(submitPost(form, 'fixture')).rejects.toMatchObject({
      definitive: true
    });
  } finally {
    globalThis.fetch = original;
  }
});
