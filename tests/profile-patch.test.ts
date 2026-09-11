import {expect, test} from 'bun:test';
import {profilePatch} from '../src/lib/server/profilePatch';
import {avatarSource, publicAvatarUrl} from '../src/lib/siteIdentity';

test('a partial change preserves untouched legacy fields and rejects unknown keys', () => {
  const current = {
    name: 'Before',
    email: 'legacy',
    manifest_settings: {display: 'standalone'}
  };
  expect(profilePatch({id: 'id', revision: 1, name: 'After'}, current)).toEqual(
    {id: 'id', revision: 1, name: 'After'}
  );
  expect(
    profilePatch({id: 'id', revision: 1, email: 'legacy'}, current)
  ).toEqual({id: 'id', revision: 1});
  expect(() => profilePatch({revision: 1, email: 'invalid'}, current)).toThrow(
    'valid email'
  );
  expect(() =>
    profilePatch({revision: 1, avatar_version: 'untrusted'}, current)
  ).toThrow('Unknown');
  expect(() =>
    profilePatch({revision: 1, site_url: 'https://example.com/path'}, current)
  ).toThrow('origin');
  expect(() => profilePatch({revision: 1, name: 'bad\u0000'}, current)).toThrow(
    'Invalid name'
  );
  expect(() =>
    profilePatch({id: null, revision: 0, name: 'New'}, null)
  ).toThrow();
});

test('Display is partial and legacy color settings cannot override theme tokens', () => {
  const current = {manifest_settings: {display: 'standalone'}};
  expect(
    profilePatch(
      {
        revision: 1,
        manifest_settings: {display: 'browser', theme_color: '#000000'}
      },
      current
    )
  ).toEqual({
    id: undefined,
    revision: 1,
    manifest_settings: {display: 'browser'}
  });
  expect(() =>
    profilePatch({manifest_settings: {display: 'invalid'}}, current)
  ).toThrow('display');
});

test('avatars use the current environment while public metadata remains absolute', () => {
  const profile = {
    avatar: 'https://production.example/avatar.png?v=old',
    avatarVersion: 'new',
    siteUrl: 'https://production.example'
  };
  for (const origin of [
    'http://localhost:5173',
    'https://preview.pages.dev',
    'https://production.example'
  ])
    expect(new URL(avatarSource(profile), origin).origin).toBe(origin);
  expect(publicAvatarUrl(profile)).toBe(
    'https://production.example/avatar.png?v=new'
  );
  expect(avatarSource({avatar: '/legacy.png'})).toBe('/legacy.png');
});
