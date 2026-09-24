import {expect, test} from 'bun:test';
import {
  clampPage,
  pageCount,
  pageOfIndex,
  pageSlice
} from '../src/lib/pagination';

const items = Array.from({length: 23}, (_, i) => i + 1);

test('pages are counted and sliced by size', () => {
  expect(pageCount(0, 10)).toBe(1);
  expect(pageCount(10, 10)).toBe(1);
  expect(pageCount(11, 10)).toBe(2);
  expect(pageSlice(items, 1, 10)).toEqual(items.slice(0, 10));
  expect(pageSlice(items, 3, 10)).toEqual([21, 22, 23]);
});

test('out of range pages are clamped', () => {
  expect(clampPage(0, 23, 10)).toBe(1);
  expect(clampPage(9, 23, 10)).toBe(3);
  expect(pageSlice(items, 9, 10)).toEqual([21, 22, 23]);
  expect(pageSlice([], 4, 10)).toEqual([]);
});

test('an item index maps to its page', () => {
  expect(pageOfIndex(0, 10)).toBe(1);
  expect(pageOfIndex(9, 10)).toBe(1);
  expect(pageOfIndex(10, 10)).toBe(2);
});
