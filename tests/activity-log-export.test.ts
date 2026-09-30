import {expect, test} from 'bun:test';
import {formatActivityLogText} from '../src/lib/server/activityLogExport';

test('text export renders every row with the raw ip and no HTML entities', () => {
  const text = formatActivityLogText([
    {
      created_at: '2026-09-27T10:00:00.000Z',
      actor: 'admin@example.com',
      action: 'profile.update',
      category: 'profile',
      summary: 'Updated &amp; renamed headline',
      ip: '203.0.113.9',
      user_agent: 'TestAgent/1.0'
    }
  ]);
  expect(text).toContain('action: profile.update');
  expect(text).toContain('summary: Updated & renamed headline');
  expect(text).toContain('ip: 203.0.113.9');
  expect(text).toContain('time: 2026-09-27 10:00:00 UTC');
});

test('an empty range renders a clear placeholder instead of nothing', () => {
  expect(formatActivityLogText([])).toBe(
    'No activity in the selected range.\n'
  );
});
