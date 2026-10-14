import { describe, expect, test } from 'bun:test';
import { avatarSources } from '../packages/lib/src/siteIdentity.ts';
import { bannerSources } from '../packages/lib/src/blogBanner.ts';

const publicId = 'a'.repeat(64);
const version = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Image sources helpers for <picture> elements', () => {
    test('avatarSources generates AVIF and WebP sources', () => {
        const sources = avatarSources({ avatarVersion: version });
        expect(sources).toHaveLength(2);
        expect(sources[0]).toEqual({
            srcset: `/avatar.avif?v=${encodeURIComponent(version)}`,
            type: 'image/avif'
        });
        expect(sources[1]).toEqual({
            srcset: `/avatar.webp?v=${encodeURIComponent(version)}`,
            type: 'image/webp'
        });
    });

    test('avatarSources returns empty when no version', () => {
        const sources = avatarSources(null);
        expect(sources).toEqual([]);
    });

    test('bannerSources generates AVIF and WebP sources', () => {
        const sources = bannerSources({ public_id: publicId, banner_version: version });
        expect(sources).toHaveLength(2);
        expect(sources[0]).toEqual({
            srcset: `/blog/banners/${publicId}/${version}.avif`,
            type: 'image/avif'
        });
        expect(sources[1]).toEqual({
            srcset: `/blog/banners/${publicId}/${version}.webp`,
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

    test('bannerSources validates version format', () => {
        expect(() => {
            bannerSources({ public_id: publicId, banner_version: 'invalid' });
        }).toThrow('Invalid banner identity');
    });
});
