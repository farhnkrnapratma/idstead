import { describe, expect, test } from 'bun:test';
import {
    avatarSource,
    avatarSources,
    avatarWebpSource,
    siteBannerOgUrl,
    siteBannerSources
} from '../packages/lib/src/siteIdentity.ts';
import { bannerSources } from '../packages/lib/src/blogBanner.ts';

const publicId = 'a'.repeat(64);
const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Image sources helpers for <picture> elements', () => {
    test('avatar loads only AVIF with a WebP fallback, without versions', () => {
        const profile = { avatarVersion: version };
        expect(avatarSources(profile)).toEqual([{ srcset: '/avatar.avif', type: 'image/avif' }]);
        expect(avatarWebpSource(profile)).toBe('/avatar.webp');
        expect(avatarWebpSource(null)).toBe('');
        expect(avatarSource(profile)).toBe('/avatar.png');
    });

    test('site banner URLs carry no version', () => {
        const profile = { bannerVersion: version };
        expect(siteBannerOgUrl(profile)).toBe('/banner-og.webp');
        expect(siteBannerSources(profile).map(source => source.srcset)).toEqual([
            '/banner.avif',
            '/banner.webp'
        ]);
    });

    test('avatarSources returns empty when no version', () => {
        const sources = avatarSources(null);
        expect(sources).toEqual([]);
    });

    test('bannerSources generates AVIF and WebP sources', () => {
        const sources = bannerSources({ public_id: publicId, banner_version: version });
        expect(sources).toHaveLength(2);
        expect(sources[0]).toEqual({
            srcset: `/blog/banners/${publicId}.avif`,
            type: 'image/avif'
        });
        expect(sources[1]).toEqual({
            srcset: `/blog/banners/${publicId}.webp`,
            type: 'image/webp'
        });
    });

    test('bannerSources returns empty when no version', () => {
        const sources = bannerSources({ public_id: publicId, banner_version: null });
        expect(sources).toEqual([]);
    });

    test('bannerSources validates public_id format', () => {
        expect(() => {
            bannerSources({ public_id: 'invalid', banner_version: version });
        }).toThrow('Invalid banner identity');
    });
});
