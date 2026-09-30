import {expect, test} from 'bun:test';
import {passwordLength, passwordPolicyError} from '../src/lib/passwordPolicy';

test('password length accepts passphrases and Unicode without composition rules', () => {
  expect(passwordPolicyError('kopi langit kabel zebra malam')).toBe('');
  expect(passwordPolicyError('a'.repeat(14))).toContain('at least 15');
  expect(passwordPolicyError('a'.repeat(15))).toBe('');
  expect(passwordPolicyError('a'.repeat(64))).toBe('');
  expect(passwordPolicyError('a'.repeat(65))).toContain('no more than 64');
  expect(passwordLength('🌙'.repeat(15))).toBe(15);
  expect(passwordPolicyError('🌙'.repeat(15))).toBe('');
  expect(passwordPolicyError('🌙'.repeat(19))).toContain('72-byte');
});
