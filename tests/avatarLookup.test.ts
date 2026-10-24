import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
    avatarFileFor,
    emailHashMatches,
    requestedAvatarSize
} from '../packages/lib/src/server/avatarLookup.ts';

const email = ' Ada@Example.com ';
const sha256 = createHash('sha256').update('ada@example.com').digest('hex');
const md5 = createHash('md5').update('ada@example.com').digest('hex');

describe('avatar lookup', () => {
    test('matches the SHA-256 or MD5 hash of the trimmed, lowercased email', () => {
        expect(emailHashMatches(sha256, email)).toBe(true);
        expect(emailHashMatches(md5.toUpperCase(), email)).toBe(true);
        expect(emailHashMatches(sha256, 'someone@example.com')).toBe(false);
        expect(emailHashMatches('not-a-hash', email)).toBe(false);
        expect(emailHashMatches(sha256, '')).toBe(false);
    });

    test('reads s or size, defaults to 80 and caps at 512', () => {
        expect(requestedAvatarSize(new URLSearchParams())).toBe(80);
        expect(requestedAvatarSize(new URLSearchParams('s=24'))).toBe(24);
        expect(requestedAvatarSize(new URLSearchParams('size=2048'))).toBe(512);
        expect(requestedAvatarSize(new URLSearchParams('s=0'))).toBe(80);
        expect(requestedAvatarSize(new URLSearchParams('s=abc'))).toBe(80);
    });

    test('serves the smallest stored file that is at least the requested size', () => {
        expect(avatarFileFor(16)).toBe('favicon-16x16.png');
        expect(avatarFileFor(17)).toBe('favicon-32x32.png');
        expect(avatarFileFor(80)).toBe('apple-touch-icon.png');
        expect(avatarFileFor(190)).toBe('android-chrome-192x192.png');
        expect(avatarFileFor(512)).toBe('avatar.png');
    });
});
