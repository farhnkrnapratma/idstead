// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    avatarSource,
    avatarSources,
    avatarWebpSource,
    siteBannerOgUrl,
    siteBannerSources
} from '../packages/lib/src/siteIdentity.ts';
import { identityVersionToken } from '../packages/domain/src/hash.ts';

const token = '26c226abc2211ab4';

describe('Image sources helpers for <picture> elements', () => {
    test('avatar loads only AVIF with a WebP fallback, with a version token', () => {
        const profile = { avatarVersion: token };
        expect(avatarSources(profile)).toEqual([
            { srcset: `/avatar.avif?v=${token}`, type: 'image/avif' }
        ]);
        expect(avatarWebpSource(profile)).toBe(`/avatar.webp?v=${token}`);
        expect(avatarWebpSource(null)).toBe('');
        expect(avatarSource(profile)).toBe(`/avatar.png?v=${token}`);
    });

    test('site banner URLs carry a version token', () => {
        const profile = { bannerVersion: token };
        expect(siteBannerOgUrl(profile)).toBe(`/banner-og.webp?v=${token}`);
        expect(siteBannerSources(profile).map(source => source.srcset)).toEqual([
            `/banner.avif?v=${token}`,
            `/banner.webp?v=${token}`
        ]);
    });

    test('profile version tokens are the opaque SHA-256 prefix of the stored version', async () => {
        expect(await identityVersionToken('7ea25243-c8fa-4124-9875-95892d6ff2b3')).toBe(token);
        expect(await identityVersionToken(null)).toBeNull();
    });

    test('avatarSources returns empty when no version', () => {
        const sources = avatarSources(null);
        expect(sources).toEqual([]);
    });
});
