import {expect, test} from 'bun:test';
import {isSameOriginRequest} from '../src/lib/server/sameOrigin';
import {
  checkLoginLockout,
  clearLoginAttempts,
  recordFailedLogin
} from '../src/lib/server/loginRateLimit';

const url = new URL('https://fkp.my.id/api/internal/admin/login');

function request(init: {method?: string; headers?: Record<string, string>}) {
  return new Request(url, {
    method: init.method ?? 'POST',
    headers: init.headers
  });
}

test('a matching Origin header passes', () => {
  expect(
    isSameOriginRequest(request({headers: {origin: 'https://fkp.my.id'}}), url)
  ).toBe(true);
});

test('a foreign Origin header is rejected', () => {
  expect(
    isSameOriginRequest(request({headers: {origin: 'https://evil.test'}}), url)
  ).toBe(false);
});

test('a mutating request with no Origin is rejected', () => {
  expect(isSameOriginRequest(request({}), url)).toBe(false);
});

test('a mutating request may fall back to Sec-Fetch-Site', () => {
  expect(
    isSameOriginRequest(
      request({headers: {'sec-fetch-site': 'same-origin'}}),
      url
    )
  ).toBe(true);
  expect(
    isSameOriginRequest(
      request({headers: {'sec-fetch-site': 'cross-site'}}),
      url
    )
  ).toBe(false);
});

test('a GET with no Origin still passes', () => {
  expect(isSameOriginRequest(request({method: 'GET'}), url)).toBe(true);
});

test('lockout trips after five failures on the same key', () => {
  const key = `ip:${crypto.randomUUID()}`;
  for (let i = 0; i < 4; i++) recordFailedLogin(key);
  expect(checkLoginLockout(key).allowed).toBe(true);
  recordFailedLogin(key);
  const locked = checkLoginLockout(key);
  expect(locked.allowed).toBe(false);
  expect(locked.retryAfterSeconds).toBeGreaterThan(0);
  clearLoginAttempts(key);
});

test('an email is locked out even when the IP keeps changing', () => {
  const email = `email:${crypto.randomUUID()}@example.test`;
  for (let i = 0; i < 5; i++)
    recordFailedLogin(`ip:${crypto.randomUUID()}`, email);
  expect(checkLoginLockout(`ip:${crypto.randomUUID()}`).allowed).toBe(true);
  expect(checkLoginLockout(email).allowed).toBe(false);
  clearLoginAttempts(email);
});

test('a successful login clears both keys', () => {
  const ip = `ip:${crypto.randomUUID()}`;
  const email = `email:${crypto.randomUUID()}@example.test`;
  for (let i = 0; i < 5; i++) recordFailedLogin(ip, email);
  expect(checkLoginLockout(ip, email).allowed).toBe(false);
  clearLoginAttempts(ip, email);
  expect(checkLoginLockout(ip, email).allowed).toBe(true);
});
