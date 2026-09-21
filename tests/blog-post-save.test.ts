import {expect, test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {savePostOperation} from '../src/lib/server/blogPostSave';
import {blogAdmin} from '../src/lib/server/blogPostAuth';

function fixture() {
  const calls: string[] = [];
  let state = 'pending';
  let loseCommit = false;
  let lookupFails = false;
  let markdownFails = false;
  const post = {
    id: crypto.randomUUID(),
    post_revision: 1,
    banner_version: crypto.randomUUID()
  };
  const input = {
    id: post.id,
    operationId: post.banner_version,
    revision: null,
    kind: 'save' as const,
    post: {},
    banner: {operation: 'replace'},
    markdown: '# Fixture',
    image: new Uint8Array([1]),
    hash: 'a'.repeat(64)
  };
  const database = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === 'db_ready_post_operation') state = 'ready';
      if (name === 'db_commit_post_operation') {
        state = 'committed';
        if (loseCommit) throw new Error('Connection lost');
      }
      return {
        data: {
          id: input.operationId,
          state,
          result: state === 'committed' ? post : null
        },
        error: null
      };
    },
    storage: {
      from: () => ({
        upload: async () => {
          calls.push('markdown');
          return {error: markdownFails ? new Error('Upload failed') : null};
        },
        download: async () => ({data: null, error: new Error('Missing object')})
      })
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data:
            lookupFails ? null : {id: input.operationId, state, result: post},
          error: lookupFails ? new Error('Offline') : null
        })
      };
      return query;
    }
  } as unknown as SupabaseClient;
  return {
    database,
    input,
    calls,
    state: () => state,
    loseCommit: () => {
      loseCommit = true;
    },
    failLookup: () => {
      lookupFails = true;
    },
    failMarkdown: () => {
      markdownFails = true;
    }
  };
}

test('failed banner and Markdown uploads never reach the commit RPC', async () => {
  const banner = fixture();
  await expect(
    savePostOperation(banner.database, 'actor', banner.input, async () => {
      throw new Error('R2 failed');
    })
  ).rejects.toThrow('R2 failed');
  expect(banner.calls).toEqual(['db_prepare_post_operation']);
  const markdown = fixture();
  markdown.failMarkdown();
  await expect(
    savePostOperation(
      markdown.database,
      'actor',
      markdown.input,
      async () => {}
    )
  ).rejects.toThrow('Markdown upload failed');
  expect(markdown.state()).toBe('pending');
  expect(markdown.calls.includes('db_commit_post_operation')).toBe(false);
});
test('lost commit responses reconcile; an unavailable status never deletes uploaded data', async () => {
  const recovered = fixture();
  recovered.loseCommit();
  expect(
    (
      await savePostOperation(
        recovered.database,
        'actor',
        recovered.input,
        async () => {}
      )
    ).state
  ).toBe('committed');
  const uncertain = fixture();
  uncertain.loseCommit();
  uncertain.failLookup();
  await expect(
    savePostOperation(
      uncertain.database,
      'actor',
      uncertain.input,
      async () => {}
    )
  ).rejects.toThrow('Connection lost');
  expect(uncertain.state()).toBe('committed');
  expect(uncertain.calls).toEqual([
    'db_prepare_post_operation',
    'markdown',
    'db_ready_post_operation',
    'db_commit_post_operation'
  ]);
});
test('admin authentication checks origin and trusted app metadata', async () => {
  const url = new URL('https://example.com/api/internal/admin/posts');
  let appRole = 'reader';
  let authCalls = 0;
  const database = {
    auth: {
      getUser: async () => {
        authCalls++;
        return {
          data: {
            user: {
              id: 'fixture',
              app_metadata: {role: appRole},
              user_metadata: {role: 'admin'}
            }
          },
          error: null
        };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: {currentLevel: 'aal1', nextLevel: 'aal1'},
          error: null
        })
      }
    }
  } as unknown as SupabaseClient;
  expect(
    (
      await blogAdmin(
        new Request(url, {
          headers: {
            Origin: 'https://evil.example',
            Authorization: 'Bearer fixture'
          }
        }),
        url,
        database
      )
    ).status
  ).toBe(403);
  expect(authCalls).toBe(0);
  expect((await blogAdmin(new Request(url), url, database)).status).toBe(401);
  expect(
    (
      await blogAdmin(
        new Request(url, {headers: {Authorization: 'Bearer fixture'}}),
        url,
        database
      )
    ).status
  ).toBe(403);
  appRole = 'admin';
  expect(
    (
      await blogAdmin(
        new Request(url, {headers: {Authorization: 'Bearer fixture'}}),
        url,
        database
      )
    ).actor
  ).toBe('fixture');
});
