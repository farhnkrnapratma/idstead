import { describe, expect, test } from 'bun:test';
import {
    avatarSource,
    avatarSources,
    avatarWebpSource,
    siteBannerOgUrl,
    siteBannerSources
} from '../packages/lib/src/siteIdentity.ts';

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
});
