import {expect, test} from 'bun:test';
import {
  countdownTone,
  extendedTimeoutMinutes,
  formatCountdown,
  remainingSeconds,
  shouldAnnounce
} from '../src/lib/sessionTimeout';

test('countdown is derived from the deadline and never negative', () => {
  expect(remainingSeconds(30_000, 0)).toBe(30);
  expect(remainingSeconds(30_000, 250)).toBe(30);
  expect(remainingSeconds(30_000, 1_000)).toBe(29);
  expect(remainingSeconds(30_000, 29_001)).toBe(1);
  expect(remainingSeconds(30_000, 30_000)).toBe(0);
  expect(remainingSeconds(30_000, 90_000)).toBe(0);
});

test('countdown formats as m:ss', () => {
  expect(formatCountdown(30)).toBe('0:30');
  expect(formatCountdown(5)).toBe('0:05');
  expect(formatCountdown(0)).toBe('0:00');
  expect(formatCountdown(75)).toBe('1:15');
  expect(formatCountdown(-3)).toBe('0:00');
});

test('urgency escalates at ten and five seconds', () => {
  expect(countdownTone(30)).toBe('normal');
  expect(countdownTone(11)).toBe('normal');
  expect(countdownTone(10)).toBe('warning');
  expect(countdownTone(6)).toBe('warning');
  expect(countdownTone(5)).toBe('danger');
  expect(countdownTone(0)).toBe('danger');
});

test('screen readers are only told at 30, 10 and 5 seconds', () => {
  const announced = Array.from({length: 31}, (_, i) => 30 - i).filter(
    shouldAnnounce
  );
  expect(announced).toEqual([30, 10, 5]);
});

test('extending doubles the idle window up to the cap', () => {
  const base = 30 * 60 * 1000;
  expect(extendedTimeoutMinutes(base, 1, 4)).toBe(60);
  expect(extendedTimeoutMinutes(base, 2, 4)).toBe(120);
  expect(extendedTimeoutMinutes(base, 4, 4)).toBe(120);
});
