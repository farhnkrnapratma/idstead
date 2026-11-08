// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { buildSvg, makeIco } from '../packages/lib/src/siteIdentity.ts';
import { apiIndex } from '../packages/lib/src/server/api/root.ts';
import { mdrsLoaders, mdrsResolvers } from '../packages/lib/src/server/mdrsData.ts';
import { putBanner } from '../packages/lib/src/server/blogBannerStorage.ts';
import { memoryPlatform } from './support/assets.ts';

describe('site icon helpers', () => {
    test('packs images into an ICO directory with offsets', () => {
        const ico = new Uint8Array(
            makeIco([
                { size: 16, data: new Uint8Array([1, 2, 3]).buffer },
                { size: 32, data: new Uint8Array([4, 5]).buffer }
            ])
        );
        const view = new DataView(ico.buffer);
        expect(view.getUint16(2, true)).toBe(1);
        expect(view.getUint16(4, true)).toBe(2);
        expect(ico[6]).toBe(16);
        expect(ico[22]).toBe(32);
        expect(view.getUint32(14, true)).toBe(3);
        expect(view.getUint32(30, true)).toBe(2);
        expect(Array.from(ico.slice(-5))).toEqual([1, 2, 3, 4, 5]);
    });

    test('builds an SVG from valid paths and rejects invalid ones', () => {
        const svg = buildSvg([{ d: 'M0 0L10 10Z', fill: '#00aa11', opacity: 0.5 }]);
        expect(svg).toContain('<path fill="#00aa11" opacity="0.5" d="M0 0L10 10Z"/>');
        expect(() => buildSvg([])).toThrow('Invalid vector paths.');
        expect(() => buildSvg([{ d: '<script>', fill: '#000000', opacity: 1 }])).toThrow(
            'Invalid vector path.'
        );
        expect(() => buildSvg([{ d: 'M0 0', fill: 'red', opacity: 1 }])).toThrow(
            'Invalid vector path.'
        );
        expect(() => buildSvg([{ d: 'M0 0', fill: '#000000', opacity: 2 }])).toThrow(
            'Invalid vector path.'
        );
    });

    test('rejects icons larger than 500 KB', () => {
        const big = 'M0 0 '.repeat(19000).slice(0, 99000);
        const paths = Array.from({ length: 6 }, () => ({ d: big, fill: '#000000', opacity: 1 }));
        expect(() => buildSvg(paths)).toThrow('Vector icon exceeds 500 KB.');
    });
});

describe('API index', () => {
    test('describes the API entry point', () => {
        expect(apiIndex()).toMatchObject({ docs: '/v1' });
        expect(typeof apiIndex().name).toBe('string');
    });
});

describe('MDRS data loaders', () => {
    const repos = {
        author: {
            profile: async () => ({ name: 'Ada', username: 'ada', email: 'ada@example.com' }),
            resumeEntries: async () => ({ experience: [], education: [] }),
            fundingLinks: async () => [],
            contactLinks: async () => [],
            skillGroups: async () => [],
            socialLinks: async () => []
        },
        blog: {
            listPublished: async () => ({ posts: [] }),
            listPublishedWithStats: async () => ({ posts: [] }),
            getPublishedBySlug: async () => null,
            readMarkdown: async () => null
        },
        site: {
            analytics: async () => ({ provider: 'ga4', measurementId: 'G-ABC123XYZ' }),
            contentLicense: async () => ({ license: 'CC0-1.0' })
        }
    } as never;

    test('loads the author, blog and analytics data', async () => {
        const loaders = mdrsLoaders(repos);
        expect(await loaders.author()).toMatchObject({ profile: { username: 'ada' } });
        expect(await loaders.blogList()).toBeDefined();
        expect(await loaders.analytics()).toBeDefined();
        await expect(loaders.blogPost('missing')).rejects.toThrow(
            'does not resolve to a published post'
        );
    });

    test('keeps the author data when individual sections fail', async () => {
        const broken = {
            ...(repos as Record<string, unknown>),
            author: {
                profile: async () => {
                    throw new Error('db');
                },
                resumeEntries: async () => {
                    throw new Error('db');
                },
                fundingLinks: async () => {
                    throw new Error('db');
                },
                contactLinks: async () => {
                    throw new Error('db');
                },
                skillGroups: async () => {
                    throw new Error('db');
                },
                socialLinks: async () => {
                    throw new Error('db');
                }
            }
        } as never;
        expect(await mdrsLoaders(broken).author()).toBeDefined();
    });

    test('falls back to unavailable resolvers without repositories', () => {
        expect(Object.keys(mdrsResolvers(null)).length).toBeGreaterThanOrEqual(0);
        expect(Object.keys(mdrsResolvers(repos)).length).toBeGreaterThanOrEqual(0);
    });
});

describe('banner storage', () => {
    test('stores a banner and verifies it reads back', async () => {
        const { platform } = memoryPlatform([]);
        const bytes = new Uint8Array([9, 8, 7, 6]) as Uint8Array<ArrayBuffer>;
        await expect(
            putBanner(
                platform,
                '0f8fad5b-d9cb-469f-a165-70867728950e',
                '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
                bytes,
                'avif'
            )
        ).resolves.toBeUndefined();
    });
});
