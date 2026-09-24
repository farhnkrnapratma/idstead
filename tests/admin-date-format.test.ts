import {expect, test} from 'bun:test';
import {
  ADMIN_DATE_FORMATS,
  ADMIN_TIME_FORMATS,
  DEFAULT_ADMIN_DISPLAY,
  formatAdminDate,
  formatAdminDateTime,
  formatAdminTime,
  isRelativeTimestamp,
  parseAdminDisplayPrefs
} from '../src/lib/adminDateFormat';

const instant = '2026-09-24T12:44:12Z';
const evening = '2026-09-24T19:45:00Z';

test('default display is absolute with a 24-hour clock', () => {
  expect(formatAdminDateTime(evening, 'UTC')).toBe('Sep 24, 2026 19:45');
  expect(DEFAULT_ADMIN_DISPLAY.mode).toBe('absolute');
});

test('every date preset renders in the requested zone', () => {
  const expected = {
    'mon-d-y': 'Sep 24, 2026',
    'dd/mm/yyyy': '24/09/2026',
    'dd/mm/yy': '24/09/26',
    'month-d-y': 'September 24, 2026',
    'wd-mon-d': 'Thu Sep 24',
    'wd-mon-d-y': 'Thu Sep 24, 2026',
    iso: '2026-09-24'
  };
  for (const format of ADMIN_DATE_FORMATS)
    expect(formatAdminDate(instant, 'UTC', format)).toBe(expected[format]);
  expect(formatAdminDate('2026-09-24T18:00:00Z', 'Asia/Jakarta', 'iso')).toBe(
    '2026-09-25'
  );
});

test('chart axis dates drop the weekday only', () => {
  expect(formatAdminDate(instant, 'UTC', 'wd-mon-d-y', true)).toBe(
    'Sep 24, 2026'
  );
  expect(formatAdminDate(instant, 'UTC', 'wd-mon-d', true)).toBe('Sep 24');
  expect(formatAdminDate(instant, 'UTC', 'iso', true)).toBe('2026-09-24');
});

test('every time preset renders padded and unpadded clocks', () => {
  const morning = '2026-09-24T09:44:12Z';
  const expected = {
    'HH:mm': '09:44',
    'H:mm': '9:44',
    'hh:mm a': '09:44 AM',
    'h:mm a': '9:44 AM',
    'HH:mm:ss': '09:44:12',
    'hh:mm:ss a': '09:44:12 AM'
  };
  for (const format of ADMIN_TIME_FORMATS)
    expect(formatAdminTime(morning, 'UTC', format)).toBe(expected[format]);
});

test('midnight and noon use the right hour in both clocks', () => {
  expect(formatAdminTime('2026-09-24T00:05:00Z', 'UTC', 'HH:mm')).toBe('00:05');
  expect(formatAdminTime('2026-09-24T00:05:00Z', 'UTC', 'h:mm a')).toBe(
    '12:05 AM'
  );
  expect(formatAdminTime('2026-09-24T12:05:00Z', 'UTC', 'h:mm a')).toBe(
    '12:05 PM'
  );
  expect(
    formatAdminDateTime('2026-09-11T17:30:00Z', 'Asia/Jakarta', {
      dateFormat: 'mon-d-y',
      timeFormat: 'HH:mm'
    })
  ).toBe('Sep 12, 2026 00:30');
});

test('invalid dates format to an empty string', () => {
  expect(formatAdminDate('nope', 'UTC')).toBe('');
  expect(formatAdminTime('nope', 'UTC')).toBe('');
  expect(formatAdminDateTime('nope', 'UTC')).toBe('');
});

test('smart mode is relative for a week and absolute after', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  expect(isRelativeTimestamp('2026-09-18T12:00:01Z', 'smart', now)).toBe(true);
  expect(isRelativeTimestamp('2026-09-17T12:00:00Z', 'smart', now)).toBe(false);
  expect(isRelativeTimestamp('2020-01-01T00:00:00Z', 'relative', now)).toBe(
    true
  );
  expect(isRelativeTimestamp('2026-09-24T11:59:00Z', 'absolute', now)).toBe(
    false
  );
});

test('stored preferences keep only whitelisted values', () => {
  expect(parseAdminDisplayPrefs(null)).toEqual({});
  expect(parseAdminDisplayPrefs('not json')).toEqual({});
  expect(parseAdminDisplayPrefs('[1]')).toEqual({});
  expect(
    parseAdminDisplayPrefs(
      JSON.stringify({mode: 'smart', dateFormat: 'iso', timeFormat: 'bogus'})
    )
  ).toEqual({mode: 'smart', dateFormat: 'iso'});
});
