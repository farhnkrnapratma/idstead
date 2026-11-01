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
import { versionToken } from '../packages/domain/src/hash.ts';

const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const token = versionToken(version);

describe('Image sources helpers for <picture> elements', () => {
    test('avatar loads only AVIF with a WebP fallback, with a version token', () => {
        const profile = { avatarVersion: version };
        expect(avatarSources(profile)).toEqual([
            { srcset: `/avatar.avif?v=${token}`, type: 'image/avif' }
        ]);
        expect(avatarWebpSource(profile)).toBe(`/avatar.webp?v=${token}`);
        expect(avatarWebpSource(null)).toBe('');
        expect(avatarSource(profile)).toBe(`/avatar.png?v=${token}`);
    });

    test('site banner URLs carry a version token', () => {
        const profile = { bannerVersion: version };
        expect(siteBannerOgUrl(profile)).toBe(`/banner-og.webp?v=${token}`);
        expect(siteBannerSources(profile).map(source => source.srcset)).toEqual([
            `/banner.avif?v=${token}`,
            `/banner.webp?v=${token}`
        ]);
    });

    test('version tokens are short hashes, never the stored UUID', () => {
        expect(token).toMatch(/^[0-9a-z]{14}$/);
        expect(token).toBe(versionToken(version));
        expect(versionToken('7c9e6679-7425-40de-944b-e07fc1f90ae8')).not.toBe(token);
        expect(avatarWebpSource({ avatarVersion: version })).not.toContain(version);
    });

    test('avatarSources returns empty when no version', () => {
        const sources = avatarSources(null);
        expect(sources).toEqual([]);
    });
});
