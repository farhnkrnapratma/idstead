import {expect, test} from 'bun:test';
import {formatBadgeCount} from '../src/lib/utils/formatters';

test('badge counts cap at 99+', () => {
  expect(formatBadgeCount(1)).toBe('1');
  expect(formatBadgeCount(42)).toBe('42');
  expect(formatBadgeCount(99)).toBe('99');
  expect(formatBadgeCount(100)).toBe('99+');
  expect(formatBadgeCount(2500)).toBe('99+');
  expect(formatBadgeCount(null)).toBe('0');
});
