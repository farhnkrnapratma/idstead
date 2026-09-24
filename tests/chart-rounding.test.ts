import {expect, test} from 'bun:test';
import {segmentRounding} from '../src/lib/chartRounding';

const keys = ['spam', 'harassment', 'other'];

test('a lone segment is rounded on every corner', () => {
  expect(segmentRounding({spam: 0, harassment: 1, other: 0}, keys, 1)).toBe(
    'all'
  );
});

test('a stack rounds only its outer ends', () => {
  const row = {spam: 1, harassment: 2, other: 3};
  expect(segmentRounding(row, keys, 0)).toBe('bottom');
  expect(segmentRounding(row, keys, 1)).toBe('none');
  expect(segmentRounding(row, keys, 2)).toBe('top');
});

test('empty segments do not count as neighbours', () => {
  const row = {spam: 1, harassment: 0, other: 3};
  expect(segmentRounding(row, keys, 0)).toBe('bottom');
  expect(segmentRounding(row, keys, 2)).toBe('top');
});
