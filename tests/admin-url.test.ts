import {expect, test} from 'bun:test';
import {cleanAdminParams} from '../src/lib/adminUrl';

const clean = (search: string, year = 2026) =>
  cleanAdminParams(new URLSearchParams(search), year).toString();

test('legacy state params are stripped from admin URLs', () => {
  expect(clean('tab=home&timeZone=Asia%2FJakarta')).toBe('');
  expect(clean('tab=reports&range=all&timeZone=UTC&from=&to=&query=spam')).toBe(
    'tab=reports&query=spam'
  );
  expect(clean('tab=feedback&range=1y&from=2025-09-24T00%3A00%3A00Z')).toBe(
    'tab=feedback'
  );
});

test('meaningful params are kept and defaults are dropped', () => {
  expect(clean('tab=posts&editPost=abc')).toBe('tab=posts&editPost=abc');
  expect(clean('tab=reports&selected=1&page=2&asOf=x')).toBe(
    'tab=reports&selected=1&page=2&asOf=x'
  );
  expect(clean('calendarYear=2026')).toBe('');
  expect(clean('calendarYear=2025')).toBe('calendarYear=2025');
  expect(clean('')).toBe('');
});
