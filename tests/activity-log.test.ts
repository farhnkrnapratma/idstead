import {expect, test} from 'bun:test';
import {logActivity} from '../src/lib/server/activityLog';

test('client IP is stored raw alongside a salted hash, and the salt/UA reach the row', async () => {
  let inserted: Record<string, unknown> | undefined;
  const db = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted = row;
        return {error: null};
      }
    })
  };
  await logActivity(
    {
      actor: 'admin@example.com',
      action: 'profile.update',
      category: 'profile',
      summary: 'Updated headline',
      userAgent: 'TestAgent/1.0',
      ip: '203.0.113.9',
      ipSalt: 'test-salt'
    },
    db
  );
  expect(inserted).toBeDefined();
  expect(inserted!.actor).toBe('admin@example.com');
  expect(inserted!.action).toBe('profile.update');
  expect(inserted!.category).toBe('profile');
  expect(inserted!.user_agent).toBe('TestAgent/1.0');
  expect(inserted!.ip).toBe('203.0.113.9');
  expect(inserted!.ip_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(inserted!.ip_hash).not.toContain('203.0.113.9');
});

test('missing salt or IP still logs the event, with a null ip and ip_hash', async () => {
  let inserted: Record<string, unknown> | undefined;
  const db = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted = row;
        return {error: null};
      }
    })
  };
  await logActivity(
    {
      actor: null,
      action: 'auth.login_failed',
      category: 'auth',
      summary: 'Invalid credentials'
    },
    db
  );
  expect(inserted!.ip).toBeNull();
  expect(inserted!.ip_hash).toBeNull();
  expect(inserted!.actor).toBeNull();
});

test('a failing insert is swallowed rather than thrown, and a missing client is a no-op', async () => {
  const db = {
    from: () => ({insert: async () => ({error: new Error('db offline')})})
  };
  await expect(
    logActivity(
      {actor: 'a', action: 'blog.publish', category: 'blog', summary: 's'},
      db
    )
  ).resolves.toBeUndefined();
  await expect(
    logActivity(
      {actor: 'a', action: 'blog.publish', category: 'blog', summary: 's'},
      null
    )
  ).resolves.toBeUndefined();
});
